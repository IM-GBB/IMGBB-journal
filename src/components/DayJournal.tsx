"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shiftDate } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";

function won(n: number, digits = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function symbolOf(instId: string) {
  return instId.replace("-SWAP", " Perpetual").replace(/-/g, "");
}

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function pnlPct(t: Trade) {
  if (t.openAvgPx && t.size && t.leverage) {
    const margin = (t.size * t.openAvgPx) / t.leverage;
    if (margin) return (t.netPnl / margin) * 100;
  }
  if (t.openAvgPx && t.closeAvgPx) {
    const dir = t.side === "short" ? -1 : 1;
    return ((t.closeAvgPx - t.openAvgPx) / t.openAvgPx) * dir * (t.leverage || 1) * 100;
  }
  return null;
}

export default function DayJournal({ date }: { date: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [equity, setEquity] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
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
    fetch("/api/account").then((r) => r.json()).then((j) => setEquity(j.equityUsd ?? null));
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
  const todayPnl = stats?.netPnl ?? 0;
  const todayPct = equity && equity > 0 ? (todayPnl / equity) * 100 : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-[#8b95a5]">← 달력</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{date}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/journal/${shiftDate(date, -1)}`} className="rounded-lg border border-[#2a313c] px-3 py-2 text-sm">이전</Link>
          <Link href={`/journal/${shiftDate(date, 1)}`} className="rounded-lg border border-[#2a313c] px-3 py-2 text-sm">다음</Link>
          <button onClick={syncDay} disabled={busy} className="rounded-lg bg-[#e8edf4] px-4 py-2 text-sm font-medium text-[#0b0d10] disabled:opacity-50">
            {busy ? "동기화 중…" : "이 날만 동기화"}
          </button>
        </div>
      </header>

      <section className="mb-6">
        <div className="text-xs text-[#8b95a5]">Estimated total value</div>
        <div className="mt-1 text-4xl font-semibold tracking-tight">
          {equity != null ? equity.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
          <span className="ml-2 text-base font-normal text-[#8b95a5]">USD</span>
        </div>
        <div className={`mt-1 text-sm ${todayPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>
          Today&apos;s PnL {won(todayPnl)}
          {todayPct != null ? ` (${won(todayPct)}%)` : ""}
        </div>
      </section>

      {msg ? <p className="mb-4 text-sm text-[#f0c674]">{msg}</p> : null}
      {!configured ? (
        <p className="mb-4 rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#8b95a5]">
          OKX 키 없음. 수동 입력만 됩니다.
        </p>
      ) : null}

      <button
        onClick={() => setChartOpen((v) => !v)}
        className="mb-3 rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
      >
        {chartOpen ? "누적 순손익 차트 닫기" : "누적 순손익 차트 열기"}
      </button>

      {chartOpen ? (
        <section className="mb-4 rounded-xl border border-[#2a313c] bg-[#14181e] p-4">
          <div className="mb-2 text-sm text-[#8b95a5]">당일 누적 순손익</div>
          <svg viewBox="0 0 400 120" className="h-28 w-full">
            <line x1="0" y1="60" x2="400" y2="60" stroke="#2a313c" />
            {points.length > 0 ? (
              <polyline
                fill="none"
                stroke={todayPnl >= 0 ? "#3dd68c" : "#f07178"}
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
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["거래", stats ? String(stats.trades) : "—"],
          ["승률", stats ? `${(stats.winRate * 100).toFixed(0)}%` : "—"],
          ["순손익", stats ? won(stats.netPnl) : "—"],
          ["수수료", stats ? won(stats.fee) : "—"],
          ["평균레버", stats?.avgLeverage != null ? `${stats.avgLeverage.toFixed(1)}x` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2">
            <div className="text-[11px] text-[#8b95a5]">{k}</div>
            <div className="mt-0.5 text-sm font-medium">{v}</div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-xl border border-[#2a313c]">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[#14181e] text-[#8b95a5]">
            <tr>
              {["Symbol", "Status", "Entry", "Exit", "Realized PnL", "PnL %", "Closed", "Lev", "Time closed", "Memo"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-[#8b95a5]">
                  이 날 기록 없음. 동기화하거나 아래에 수동으로 추가.
                </td>
              </tr>
            ) : (
              trades.map((t) => {
                const pct = pnlPct(t);
                return (
                  <tr key={t.id} className="border-t border-[#2a313c]">
                    <td className="px-3 py-3">
                      <div className="font-medium">{symbolOf(t.instId)}</div>
                      <div className="text-xs text-[#8b95a5]">{t.side}</div>
                    </td>
                    <td className="px-3 py-3 text-[#8b95a5]">Closed</td>
                    <td className="px-3 py-3">{t.openAvgPx ?? "—"}</td>
                    <td className="px-3 py-3">{t.closeAvgPx ?? "—"}</td>
                    <td className={`px-3 py-3 ${t.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(t.netPnl)}</td>
                    <td className={`px-3 py-3 ${t.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>
                      {pct == null ? "—" : `${won(pct)}%`}
                    </td>
                    <td className="px-3 py-3">{t.size ?? "—"}</td>
                    <td className="px-3 py-3">{t.leverage ? `${t.leverage}x` : "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtTime(t.closedAt)}</td>
                    <td className="px-3 py-3">
                      <input
                        defaultValue={t.memo}
                        className="w-36 rounded border border-[#2a313c] bg-transparent px-2 py-1"
                        onBlur={(e) => saveMemo(t.id, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })
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