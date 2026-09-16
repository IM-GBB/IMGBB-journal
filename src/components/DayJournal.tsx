"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shiftDate } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";
import HoverAreaChart from "@/components/HoverAreaChart";
import { money, roiPct, tickerOf } from "@/lib/format";

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
  return new Intl.DateTimeFormat("en-GB", {
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
  const [note, setNote] = useState("");
  const [chartOpen, setChartOpen] = useState(true);
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
  }, [load]);

  const selected = useMemo(() => trades.find((t) => t.id === openId) || null, [trades, openId]);

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
      setMsg(json.error || "failed");
      return;
    }
    setMsg(`${json.synced} synced`);
    await load();
  }

  async function saveNote() {
    await fetch("/api/day-note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, note }),
    });
    setMsg("note saved");
  }

  async function saveMeta() {
    if (!openId) return;
    await fetch("/api/trades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: openId, memo: draft.memo, tags: draft.tags, rating: draft.rating || null }),
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

  const chartPts = useMemo(() => {
    let c = 0;
    return trades.map((t, i) => {
      c += t.netPnl;
      return { label: `${hhmm(t.closedAt)} #${i + 1}`, value: c };
    });
  }, [trades]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-[#6b7280]">← Day View</Link>
          <h1 className="mt-1 text-3xl font-semibold">{date}</h1>
          <p className={`mt-1 text-lg font-semibold ${stats && stats.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
            Net P&L {stats ? money(stats.netPnl) : "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/journal/${shiftDate(date, -1)}`} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm">Prev</Link>
          <Link href={`/journal/${shiftDate(date, 1)}`} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm">Next</Link>
          <button onClick={syncDay} disabled={busy} className="rounded-lg bg-[#6d5cff] px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy ? "IMGBB…" : "IMGBB"}
          </button>
        </div>
      </header>

      {msg ? <p className="mb-4 text-sm text-[#6d5cff]">{msg}</p> : null}

      <button onClick={() => setChartOpen((v) => !v)} className="mb-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm">
        {chartOpen ? "Hide chart" : "Show chart"}
      </button>

      {chartOpen ? (
        <section className="mb-4 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-[#6b7280]">Intraday cumulative Net P&L</div>
          <HoverAreaChart points={chartPts} baseline={0} />
        </section>
      ) : null}

      <section className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["Trades", stats ? String(stats.trades) : "—"],
          ["Win rate", stats ? `${(stats.winRate * 100).toFixed(0)}%` : "—"],
          ["Net P&L", stats ? money(stats.netPnl) : "—"],
          ["Fees", stats ? money(stats.fee) : "—"],
          ["Avg lev", stats?.avgLeverage != null ? `${stats.avgLeverage.toFixed(1)}x` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-2 shadow-sm">
            <div className="text-[11px] text-[#6b7280]">{k}</div>
            <div className="text-sm font-semibold text-[#111827]">{v}</div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-[#6b7280]">
            <tr>
              {["Ticker", "Side", "Instrument", "Net P&L", "Net ROI", "Fee", "Funding", "Lev", "Entry", "Exit", "Size", "Time"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-[#6b7280]">No trades</td>
              </tr>
            ) : (
              trades.map((t) => {
                const tk = tickerOf(t.instId);
                const r = roi(t);
                return (
                  <tr
                    key={t.id}
                    onClick={() => {
                      setOpenId(t.id);
                      setDraft({ memo: t.memo || "", tags: t.tags || "", rating: t.rating || 0 });
                    }}
                    className="cursor-pointer border-t border-[#f3f4f6] hover:bg-[#f9fafb]"
                  >
                    <td className="px-3 py-2"><span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs text-[#111827]">{tk}</span></td>
                    <td className="px-3 py-2 uppercase">{t.side}</td>
                    <td className="px-3 py-2 text-[#6b7280]">{tk}</td>
                    <td className={`px-3 py-2 ${t.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>{money(t.netPnl)}</td>
                    <td className={`px-3 py-2 ${t.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>{roiPct(r)}</td>
                    <td className="px-3 py-2">{money(t.fee)}</td>
                    <td className="px-3 py-2">{money(t.fundingFee)}</td>
                    <td className="px-3 py-2">{t.leverage ?? "—"}</td>
                    <td className="px-3 py-2">{t.openAvgPx == null ? "—" : t.openAvgPx.toFixed(2)}</td>
                    <td className="px-3 py-2">{t.closeAvgPx == null ? "—" : t.closeAvgPx.toFixed(2)}</td>
                    <td className="px-3 py-2">{t.size == null ? "—" : t.size.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-[#6b7280]">{hhmm(t.closedAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={addManual} className="mt-6 grid gap-2 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm md:grid-cols-6">
        <input className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-2 text-[#111827]" value={form.instId} onChange={(e) => setForm({ ...form, instId: e.target.value })} />
        <select className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-2" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
          <option value="long">long</option>
          <option value="short">short</option>
        </select>
        <input className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-2" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: e.target.value })} />
        <input className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-2" value={form.netPnl} onChange={(e) => setForm({ ...form, netPnl: e.target.value })} placeholder="net pnl" />
        <input className="rounded-lg border border-[#e5e7eb] bg-white px-2 py-2" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="memo" />
        <button className="rounded-lg bg-[#6d5cff] px-3 py-2 text-white">Add manual</button>
      </form>

      <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm text-[#6b7280]">Day note</div>
        <textarea className="h-24 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={saveNote} className="mt-2 rounded-lg bg-[#6d5cff] px-3 py-2 text-sm text-white">Save note</button>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setOpenId(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex justify-between">
              <div>
                <div className="text-xs uppercase text-[#6b7280]">{selected.side}</div>
                <h2 className="text-xl font-semibold">{tickerOf(selected.instId)}</h2>
              </div>
              <button onClick={() => setOpenId(null)} className="text-sm text-[#6b7280]">Close</button>
            </div>
            <div className={`mb-4 text-3xl font-semibold ${selected.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>{money(selected.netPnl)}</div>
            <div className="mb-4 text-sm text-[#6b7280]">ROI {roiPct(roi(selected))}</div>
            <label className="mb-3 block text-sm">
              Tags
              <input className="mt-1 w-full rounded-lg border border-[#e5e7eb] px-2 py-2" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} />
            </label>
            <label className="mb-4 block text-sm">
              Memo
              <textarea className="mt-1 h-28 w-full rounded-lg border border-[#e5e7eb] px-2 py-2" value={draft.memo} onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))} />
            </label>
            <button onClick={saveMeta} className="w-full rounded-lg bg-[#6d5cff] px-3 py-2 text-white">Save</button>
          </aside>
        </div>
      ) : null}
    </main>
  );
}