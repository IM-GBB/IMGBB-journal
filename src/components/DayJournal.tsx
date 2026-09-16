"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shiftDate } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";
import HoverAreaChart from "@/components/HoverAreaChart";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tickerOf(instId: string) {
  return instId.replace("-SWAP", "").replace("-USDT", "USDT").replace(/-/g, "");
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
  const [configured, setConfigured] = useState(false);
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

  const chartPts = useMemo(() => {
    let c = 0;
    return trades.map((t, i) => {
      c += t.netPnl;
      return { label: `${hhmm(t.closedAt)} #${i + 1}`, value: c };
    });
  }, [trades]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-[#8b95a5]">← Day View</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{date}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/journal/${shiftDate(date, -1)}`} className="rounded-lg border border-[#2a313c] px-3 py-2 text-sm">Prev</Link>
          <Link href={`/journal/${shiftDate(date, 1)}`} className="rounded-lg border border-[#2a313c] px-3 py-2 text-sm">Next</Link>
          <button onClick={syncDay} disabled={busy} className="rounded-lg bg-[#e8edf4] px-4 py-2 text-sm font-medium text-[#0b0d10] disabled:opacity-50">
            {busy ? "Syncing…" : "Sync this day"}
          </button>
        </div>
      </header>

      {msg ? <p className="mb-4 text-sm text-[#f0c674]">{msg}</p> : null}
      {!configured ? (
        <p className="mb-4 rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#8b95a5]">No OKX key. Manual entry only.</p>
      ) : null}

      <div className="mb-3">
        <button onClick={() => setChartOpen((v) => !v)} className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm">
          {chartOpen ? "Hide chart" : "Show chart"}
        </button>
      </div>

      {chartOpen ? (
        <section className="mb-3 rounded-xl border border-[#2a313c] bg-[#14181e] p-4">
          <div className="mb-1 text-sm text-[#8b95a5]">Intraday cumulative Net P&L</div>
          <HoverAreaChart points={chartPts} baseline={0} />
        </section>
      ) : null}

      <section className="mb-6 grid grid-cols-3 gap-2 md:grid-cols-5">
        {[
          ["Trades", stats ? String(stats.trades) : "—"],
          ["Win rate", stats ? `${(stats.winRate * 100).toFixed(0)}%` : "—"],
          ["Net P&L", stats ? won(stats.netPnl) : "—"],
          ["Fees", stats ? won(stats.fee) : "—"],
          ["Avg lev", stats?.avgLeverage != null ? `${stats.avgLeverage.toFixed(1)}x` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2">
            <div className="text-[10px] text-[#8b95a5]">{k}</div>
            <div className="text-sm font-medium">{v}</div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-xl border border-[#2a313c]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#14181e] text-[#8b95a5]">
            <tr>
              {["Open time", "Ticker", "Side", "Instrument", "Net P&L", "Net ROI"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#8b95a5]">No trades</td>
              </tr>
            ) : (
              trades.map((t) => {
                const r = roi(t);
                const tk = tickerOf(t.instId);
                return (
                  <tr key={t.id} onClick={() => openPanel(t)} className="cursor-pointer border-t border-[#2a313c] hover:bg-[#1b2028]">
                    <td className="px-3 py-2 whitespace-nowrap text-[#8b95a5]">{hhmm(t.closedAt)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-[#1b2028] px-2 py-0.5 text-xs">{tk}</span>
                    </td>
                    <td className="px-3 py-2 uppercase">{t.side}</td>
                    <td className="px-3 py-2 text-[#8b95a5]">{tk}</td>
                    <td className={`px-3 py-2 ${t.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(t.netPnl)}</td>
                    <td className={`px-3 py-2 ${t.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>
                      {r == null ? "—" : `${won(r)}%`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={addManual} className="mt-6 grid gap-2 rounded-xl border border-[#2a313c] bg-[#14181e] p-4 md:grid-cols-6">
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.instId} onChange={(e) => setForm({ ...form, instId: e.target.value })} placeholder="instId" />
        <select className="rounded border border-[#2a313c] bg-[#0b0d10] px-2 py-2" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
          <option value="long">long</option>
          <option value="short">short</option>
        </select>
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: e.target.value })} placeholder="lev" />
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.netPnl} onChange={(e) => setForm({ ...form, netPnl: e.target.value })} placeholder="net pnl" />
        <input className="rounded border border-[#2a313c] bg-transparent px-2 py-2" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="memo" />
        <button className="rounded-lg bg-[#e8edf4] px-3 py-2 text-[#0b0d10]">Add manual</button>
      </form>

      <section className="mt-6 rounded-xl border border-[#2a313c] bg-[#14181e] p-4">
        <div className="mb-2 text-sm text-[#8b95a5]">Day note</div>
        <textarea
          className="h-24 w-full rounded border border-[#2a313c] bg-transparent px-3 py-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="market, mistakes, next rule"
        />
        <button onClick={saveNote} className="mt-2 rounded-lg bg-[#e8edf4] px-3 py-2 text-sm text-[#0b0d10]">Save note</button>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => setOpenId(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-[#2a313c] bg-[#14181e] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase text-[#8b95a5]">{selected.side}</div>
                <h2 className="text-xl font-semibold">{tickerOf(selected.instId)}</h2>
                <div className="text-xs text-[#8b95a5]">{hhmm(selected.closedAt)}</div>
              </div>
              <button onClick={() => setOpenId(null)} className="text-sm text-[#8b95a5]">Close</button>
            </div>
            <div className={`mb-2 text-3xl font-semibold ${selected.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(selected.netPnl)}</div>
            <div className="mb-6 text-sm text-[#8b95a5]">ROI {roi(selected) == null ? "—" : `${won(roi(selected) || 0)}%`}</div>
            <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[#8b95a5]">Entry</dt><dd>{selected.openAvgPx == null ? "—" : won(selected.openAvgPx)}</dd></div>
              <div><dt className="text-[#8b95a5]">Exit</dt><dd>{selected.closeAvgPx == null ? "—" : won(selected.closeAvgPx)}</dd></div>
              <div><dt className="text-[#8b95a5]">Size</dt><dd>{selected.size == null ? "—" : won(selected.size)}</dd></div>
              <div><dt className="text-[#8b95a5]">Lev</dt><dd>{selected.leverage ?? "—"}</dd></div>
              <div><dt className="text-[#8b95a5]">Fee</dt><dd>{won(selected.fee)}</dd></div>
              <div><dt className="text-[#8b95a5]">Funding</dt><dd>{won(selected.fundingFee)}</dd></div>
            </dl>
            <label className="mb-3 block text-sm">
              <span className="text-[#8b95a5]">Rating</span>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setDraft((d) => ({ ...d, rating: n }))} className={n <= draft.rating ? "text-[#f0c674]" : "text-[#2a313c]"}>★</button>
                ))}
              </div>
            </label>
            <label className="mb-3 block text-sm">
              <span className="text-[#8b95a5]">Tags</span>
              <input className="mt-1 w-full rounded border border-[#2a313c] bg-transparent px-2 py-2" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} />
            </label>
            <label className="mb-4 block text-sm">
              <span className="text-[#8b95a5]">Memo</span>
              <textarea className="mt-1 h-28 w-full rounded border border-[#2a313c] bg-transparent px-2 py-2" value={draft.memo} onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))} />
            </label>
            <button onClick={saveMeta} className="w-full rounded-lg bg-[#e8edf4] px-3 py-2 text-[#0b0d10]">Save</button>
          </aside>
        </div>
      ) : null}
    </main>
  );
}