"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shiftDate } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

export default function DayJournal({ date }: { date: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [form, setForm] = useState({ instId: "BTC-USDT-SWAP", side: "long", leverage: "10", netPnl: "", memo: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/trades?date=${date}`);
    const json = await res.json();
    setTrades(json.trades || []);
    setStats(json.stats || null);
  }, [date]);

  useEffect(() => {
    load();
    fetch("/api/sync").then((r) => r.json()).then((j) => setConfigured(Boolean(j.configured)));
  }, [load]);

  async function syncDay() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "실패");
      return;
    }
    setMsg(`${json.synced}건 동기화`);
    await load();
  }

  async function saveMemo(id: string, memo: string) {
    await fetch("/api/trades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, memo }),
    });
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateKst: date,
        instId: form.instId,
        side: form.side,
        leverage: Number(form.leverage) || null,
        netPnl: Number(form.netPnl || 0),
        memo: form.memo,
      }),
    });
    setForm((f) => ({ ...f, netPnl: "", memo: "" }));
    await load();
  }

  const points = useMemo(() => {
    let c = 0;
    return trades.map((t, i) => {
      c += t.netPnl;
      return { i, c };
    });
  }, [trades]);

  const maxAbs = Math.max(1, ...points.map((p) => Math.abs(p.c)));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-[#8b95a5]">← 달력</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{date}</h1>
          <p className="text-sm text-[#8b95a5]">청산 시각 기준 · KST 하루만 동기화</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/journal/${shiftDate(date, -1)}`} className="rounded-lg border border-[#2a313c] px-3 py-2 text-sm">이전</Link>
          <Link href={`/journal/${shiftDate(date, 1)}`} className="rounded-lg border border-[#2a313c] px-3 py-2 text-sm">다음</Link>
          <button
            onClick={syncDay}
            disabled={busy}
            className="rounded-lg bg-[#e8edf4] px-4 py-2 text-sm font-medium text-[#0b0d10] disabled:opacity-50"
          >
            {busy ? "동기화 중…" : "이 날만 동기화"}
          </button>
        </div>
      </header>

      {msg ? <p className="mb-4 text-sm text-[#f0c674]">{msg}</p> : null}
      {!configured ? (
        <p className="mb-4 rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#8b95a5]">
          OKX 키 없음. `.env.local`에 Read-only 키를 넣기 전에는 수동 입력만 됩니다.
        </p>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["거래", stats ? String(stats.trades) : "—"],
          ["승률", stats ? `${(stats.winRate * 100).toFixed(0)}%` : "—"],
          ["순손익", stats ? won(stats.netPnl) : "—"],
          ["수수료", stats ? won(stats.fee) : "—"],
          ["평균레버", stats?.avgLeverage != null ? `${stats.avgLeverage.toFixed(1)}x` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[#2a313c] bg-[#14181e] px-4 py-3">
            <div className="text-xs text-[#8b95a5]">{k}</div>
            <div className="mt-1 text-lg font-medium">{v}</div>
          </div>
        ))}
      </section>

      <section className="mb-6 rounded-xl border border-[#2a313c] bg-[#14181e] p-4">
        <div className="mb-2 text-sm text-[#8b95a5]">당일 누적 순손익</div>
        <svg viewBox="0 0 400 120" className="h-28 w-full">
          <line x1="0" y1="60" x2="400" y2="60" stroke="#2a313c" />
          {points.length > 0 ? (
            <polyline
              fill="none"
              stroke="#3dd68c"
              strokeWidth="2"
              points={points
                .map((p, idx) => {
                  const x = (idx / Math.max(points.length - 1, 1)) * 400;
                  const y = 60 - (p.c / maxAbs) * 50;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          ) : null}
        </svg>
      </section>

      <div className="overflow-x-auto rounded-xl border border-[#2a313c]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#14181e] text-[#8b95a5]">
            <tr>
              {["시간", "상품", "방향", "레버", "진입", "청산", "실현", "수수료", "펀딩", "순손익", "승패", "메모"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-[#8b95a5]">
                  이 날 기록 없음. 동기화하거나 아래에 수동으로 추가.
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id} className="border-t border-[#2a313c]">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(t.closedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
                  <td className="px-3 py-2">{t.instId}</td>
                  <td className="px-3 py-2">{t.side}</td>
                  <td className="px-3 py-2">{t.leverage ?? "—"}</td>
                  <td className="px-3 py-2">{t.openAvgPx ?? "—"}</td>
                  <td className="px-3 py-2">{t.closeAvgPx ?? "—"}</td>
                  <td className="px-3 py-2">{won(t.realizedPnl)}</td>
                  <td className="px-3 py-2">{won(t.fee)}</td>
                  <td className="px-3 py-2">{won(t.fundingFee)}</td>
                  <td className={`px-3 py-2 ${t.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(t.netPnl)}</td>
                  <td className="px-3 py-2">{t.win ? "승" : "패"}</td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={t.memo}
                      className="w-36 rounded border border-[#2a313c] bg-transparent px-2 py-1"
                      onBlur={(e) => saveMemo(t.id, e.target.value)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={addManual} className="mt-6 grid gap-2 rounded-xl border border-[#2a313c] bg-[#14181e] p-4 md:grid-cols-6">
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.instId} onChange={(e) => setForm({ ...form, instId: e.target.value })} placeholder="상품" />
        <select className="rounded border border-[#2a313c] bg-[#0b0d10] px-2 py-2" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
          <option value="long">long</option>
          <option value="short">short</option>
        </select>
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: e.target.value })} placeholder="레버" />
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.netPnl} onChange={(e) => setForm({ ...form, netPnl: e.target.value })} placeholder="순손익" />
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="메모" />
        <button className="rounded-lg bg-[#e8edf4] px-3 py-2 text-[#0b0d10]">수동 추가</button>
      </form>
    </main>
  );
}
