"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shiftDate } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function roi(t: Trade) {
  if (t.openAvgPx && t.size && t.leverage) {
    const margin = (t.size * t.openAvgPx) / t.leverage;
    if (margin) return (t.netPnl / margin) * 100;
  }
  return null;
}

function hhmm(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export default function DayJournal({ date }: { date: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [note, setNote] = useState("");
  const [form, setForm] = useState({ instId: "BTC-USDT-SWAP", side: "long", leverage: "10", netPnl: "", memo: "" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ memo: "", tags: "", rating: 0 });

  const load = useCallback(async () => {
    const [tr, dn] = await Promise.all([
      fetch(`/api/trades?date=${date}`).then((r) => r.json()),
      fetch(`/api/day-note?date=${date}`).then((r) => r.json()),
    ]);
    setTrades(tr.trades || []);
    setStats(tr.stats || null);
    setNote(dn.note || "");
  }, [date]);

  useEffect(() => {
    load();
    fetch("/api/sync")
      .then((r) => r.json())
      .then((j) => setConfigured(Boolean(j.configured)));
  }, [load]);

  const selected = useMemo(() => trades.find((t) => t.id === openId) || null, [trades, openId]);

  function openPanel(t: Trade) {
    setOpenId(t.id);
    setDraft({ memo: t.memo || "", tags: t.tags || "", rating: t.rating || 0 });
  }

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

  async function saveNote() {
    await fetch("/api/day-note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, note }),
    });
    setMsg("노트 저장");
  }

  async function saveMeta() {
    if (!openId) return;
    await fetch("/api/trades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: openId,
        memo: draft.memo,
        tags: draft.tags,
        rating: draft.rating || null,
      }),
    });
    await load();
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
    return trades.map((t) => {
      c += t.netPnl;
      return c;
    });
  }, [trades]);
  const maxAbs = Math.max(1, ...points.map((p) => Math.abs(p)));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-[#8b95a5]">← Day View</Link>
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

      {msg ? <p className="mb-4 text-sm text-[#f0c674]">{msg}</p> : null}
      {!configured ? (
        <p className="mb-4 rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#8b95a5]">OKX 키 없음. 수동 입력만 됩니다.</p>
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
        <div className="mb-2 text-sm text-[#8b95a5]">Day note</div>
        <textarea
          className="h-24 w-full rounded border border-[#2a313c] bg-transparent px-3 py-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="오늘 시장, 실수, 다음 규칙"
        />
        <button onClick={saveNote} className="mt-2 rounded-lg bg-[#e8edf4] px-3 py-2 text-sm text-[#0b0d10]">노트 저장</button>
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
                .map((c, idx) => {
                  const x = (idx / Math.max(points.length - 1, 1)) * 400;
                  const y = 60 - (c / maxAbs) * 50;
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
              {["시간", "상품", "방향", "레버", "진입", "청산", "순손익", "ROI", "승패"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-[#8b95a5]">이 날 기록 없음</td>
              </tr>
            ) : (
              trades.map((t) => {
                const r = roi(t);
                return (
                  <tr key={t.id} onClick={() => openPanel(t)} className="cursor-pointer border-t border-[#2a313c] hover:bg-[#1b2028]">
                    <td className="px-3 py-2 whitespace-nowrap">{hhmm(t.closedAt)}</td>
                    <td className="px-3 py-2">{t.instId}</td>
                    <td className="px-3 py-2 uppercase">{t.side}</td>
                    <td className="px-3 py-2">{t.leverage ?? "—"}</td>
                    <td className="px-3 py-2">{t.openAvgPx ?? "—"}</td>
                    <td className="px-3 py-2">{t.closeAvgPx ?? "—"}</td>
                    <td className={`px-3 py-2 ${t.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(t.netPnl)}</td>
                    <td className="px-3 py-2">{r == null ? "—" : `${won(r)}%`}</td>
                    <td className="px-3 py-2">{t.win ? "승" : "패"}</td>
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

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => setOpenId(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-[#2a313c] bg-[#14181e] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase text-[#8b95a5]">{selected.side}</div>
                <h2 className="text-xl font-semibold">{selected.instId}</h2>
                <div className="text-xs text-[#8b95a5]">{hhmm(selected.closedAt)}</div>
              </div>
              <button onClick={() => setOpenId(null)} className="text-sm text-[#8b95a5]">닫기</button>
            </div>
            <div className={`mb-4 text-3xl font-semibold ${selected.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(selected.netPnl)}</div>
            <div className="mb-6 text-sm text-[#8b95a5]">ROI {roi(selected) == null ? "—" : `${won(roi(selected) || 0)}%`}</div>
            <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[#8b95a5]">Entry</dt><dd>{selected.openAvgPx ?? "—"}</dd></div>
              <div><dt className="text-[#8b95a5]">Exit</dt><dd>{selected.closeAvgPx ?? "—"}</dd></div>
              <div><dt className="text-[#8b95a5]">Size</dt><dd>{selected.size ?? "—"}</dd></div>
              <div><dt className="text-[#8b95a5]">Lev</dt><dd>{selected.leverage ?? "—"}</dd></div>
              <div><dt className="text-[#8b95a5]">Fee</dt><dd>{won(selected.fee)}</dd></div>
              <div><dt className="text-[#8b95a5]">Funding</dt><dd>{won(selected.fundingFee)}</dd></div>
            </dl>
            <label className="mb-3 block text-sm">
              <span className="text-[#8b95a5]">별점</span>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setDraft((d) => ({ ...d, rating: n }))} className={n <= draft.rating ? "text-[#f0c674]" : "text-[#2a313c]"}>★</button>
                ))}
              </div>
            </label>
            <label className="mb-3 block text-sm">
              <span className="text-[#8b95a5]">태그</span>
              <input className="mt-1 w-full rounded border border-[#2a313c] bg-transparent px-2 py-2" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} />
            </label>
            <label className="mb-4 block text-sm">
              <span className="text-[#8b95a5]">메모</span>
              <textarea className="mt-1 h-28 w-full rounded border border-[#2a313c] bg-transparent px-2 py-2" value={draft.memo} onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))} />
            </label>
            <button onClick={saveMeta} className="w-full rounded-lg bg-[#e8edf4] px-3 py-2 text-[#0b0d10]">저장</button>
          </aside>
        </div>
      ) : null}
    </main>
  );
}