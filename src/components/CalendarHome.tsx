"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { daysInMonth, kstDateKey } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";
import HoverAreaChart from "@/components/HoverAreaChart";
import { money, roiPct, tickerOf, weekday } from "@/lib/format";

function roi(t: Trade) {
  if (t.openAvgPx && t.size && t.leverage) {
    const margin = (t.size * t.openAvgPx) / t.leverage;
    if (margin) return (t.netPnl / margin) * 100;
  }
  return null;
}

function closedPnl(t: Trade) {
  return t.netPnl - t.fee - t.fundingFee;
}

function enrich(list: Trade[]) {
  const volume = list.reduce((s, t) => s + (t.size || 0), 0);
  const gross = list.reduce((s, t) => s + closedPnl(t), 0);
  const winSum = list.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const loseSum = list.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0);
  const pf = loseSum < 0 ? winSum / Math.abs(loseSum) : winSum > 0 ? Infinity : null;
  return { volume, gross, pf };
}

function weekStart(dateKst: string) {
  const d = new Date(`${dateKst}T12:00:00+09:00`);
  d.setDate(d.getDate() - d.getDay());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Stat({ k, v, good }: { k: string; v: string; good?: number }) {
  const color = good == null ? "" : good > 0 ? "text-[#16a34a]" : good < 0 ? "text-[#ef4444]" : "";
  return (
    <div>
      <div className="text-[11px] text-[#6b7280]">{k}</div>
      <div className={`text-sm font-semibold ${color}`}>{v}</div>
    </div>
  );
}

export default function CalendarHome() {
  const today = kstDateKey();
  const [days, setDays] = useState<DayStats[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rebates, setRebates] = useState<{ dateKst: string; amount: number }[]>([]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [mode, setMode] = useState<"day" | "week">("day");
  const [open, setOpen] = useState<string>("");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [dayBusy, setDayBusy] = useState(false);
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  async function reload() {
    const [ov, tr, rb] = await Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/trades").then((r) => r.json()),
      fetch("/api/rebates").then((r) => r.json()).catch(() => ({ rebates: [] })),
    ]);
    const list: DayStats[] = ov.days || [];
    setDays(list);
    setTrades(tr.trades || []);
    setRebates(rb.rebates || []);
    if (list.length) setMonth(list[list.length - 1].dateKst.slice(0, 7));
  }

  useEffect(() => {
    reload();
  }, []);

  const rebateMap = useMemo(() => new Map(rebates.map((r) => [r.dateKst, r.amount])), [rebates]);

  const byDate = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of trades) {
      const arr = m.get(t.dateKst) || [];
      arr.push(t);
      m.set(t.dateKst, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => b.closedAt.localeCompare(a.closedAt));
    return m;
  }, [trades]);

  const monthDays = useMemo(
    () => days.filter((d) => d.dateKst.startsWith(month)).slice().reverse(),
    [days, month]
  );
  const months = useMemo(
    () => [...new Set(days.map((d) => d.dateKst.slice(0, 7)))].sort().reverse(),
    [days]
  );

  const y = Number(month.slice(0, 4)) || Number(today.slice(0, 4));
  const mo = Number(month.slice(5, 7)) || Number(today.slice(5, 7));
  const count = daysInMonth(y, mo);
  const first = new Date(`${y}-${String(mo).padStart(2, "0")}-01T12:00:00+09:00`);
  const pad = first.getDay();
  const statsMap = useMemo(() => new Map(days.map((d) => [d.dateKst, d])), [days]);

  async function syncDates(dates: string[]) {
    setSyncBusy(true);
    setSyncMsg("");
    let ok = 0;
    let added = 0;
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      setSyncMsg(`${date} ${i + 1}/${dates.length}`);
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSyncMsg(json.error || "failed");
        setSyncBusy(false);
        setDayBusy(false);
        return;
      }
      ok += 1;
      added += json.synced || 0;
    }
    setSyncBusy(false);
    setDayBusy(false);
    setSyncMsg(`${ok} days · ${added} trades`);
    await reload();
  }

  async function syncMonth() {
    const todayKey = kstDateKey();
    const last = month === todayKey.slice(0, 7) ? Number(todayKey.slice(8, 10)) : count;
    const dates = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
    await syncDates(dates);
  }

  async function syncToday() {
    setDayBusy(true);
    await syncDates([kstDateKey()]);
  }

  async function openNote(date: string) {
    setNoteDate(date);
    const j = await fetch(`/api/day-note?date=${date}`).then((r) => r.json());
    setNoteText(j.note || "");
  }

  async function saveNote() {
    if (!noteDate) return;
    await fetch("/api/day-note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: noteDate, note: noteText }),
    });
    setNoteDate(null);
  }

  const dayCards = monthDays.length
    ? monthDays
    : today.startsWith(month)
      ? [
          {
            dateKst: today,
            trades: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            realizedPnl: 0,
            fee: 0,
            fundingFee: 0,
            netPnl: 0,
            avgLeverage: null,
          } as DayStats,
        ]
      : [];

  const weekCards = useMemo(() => {
    const groups = new Map<string, DayStats[]>();
    for (const d of [...dayCards].reverse()) {
      const key = weekStart(d.dateKst);
      const arr = groups.get(key) || [];
      arr.push(d);
      groups.set(key, arr);
    }
    return [...groups.entries()].reverse().map(([start, list]) => {
      const endD = new Date(`${start}T12:00:00+09:00`);
      endD.setDate(endD.getDate() + 6);
      const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
      const tradesN = list.reduce((s, d) => s + d.trades, 0);
      const wins = list.reduce((s, d) => s + d.wins, 0);
      const net = list.reduce((s, d) => s + d.netPnl, 0);
      const fee = list.reduce((s, d) => s + d.fee, 0);
      const rebate = list.reduce((s, d) => s + (rebateMap.get(d.dateKst) || 0), 0);
      return { start, end, list, tradesN, wins, losses: tradesN - wins, net, fee, rebate };
    });
  }, [dayCards, rebateMap]);

  function tradeTable(list: Trade[]) {
    return (
      <div className="max-w-full overflow-x-auto border-t border-[#f3f4f6]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-[#6b7280]">
            <tr>
              {["Ticker", "Side", "Instrument", "Net P&L", "Net ROI", "Closed P&L", "Fee", "Funding", "Lev", "Size", "Time"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-[#6b7280]">No trades</td>
              </tr>
            ) : (
              list.map((t) => {
                const tk = tickerOf(t.instId);
                const r = roi(t);
                const closed = closedPnl(t);
                return (
                  <tr key={t.id} className="border-t border-[#f3f4f6]">
                    <td className="px-3 py-2">
                      <Link href={`/journal/${t.dateKst}`} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">
                        {tk}
                      </Link>
                    </td>
                    <td className="px-3 py-2 uppercase">{t.side}</td>
                    <td className="px-3 py-2 text-[#6b7280]">{tk}</td>
                    <td className={`px-3 py-2 font-semibold ${t.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>{money(t.netPnl)}</td>
                    <td className="px-3 py-2 text-[#111827]">{roiPct(r)}</td>
                    <td className="px-3 py-2 text-[#111827]">{money(closed)}</td>
                    <td className="px-3 py-2">{money(t.fee)}</td>
                    <td className="px-3 py-2">{money(t.fundingFee)}</td>
                    <td className="px-3 py-2">{t.leverage ?? "—"}</td>
                    <td className="px-3 py-2">{t.size == null ? "—" : t.size.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-[#6b7280]">
                      {new Date(t.closedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour12: false })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function dayBlock(st: DayStats) {
    const list = byDate.get(st.dateKst) || [];
    const extra = enrich(list);
    const expanded = open === st.dateKst;
    const rebate = rebateMap.get(st.dateKst) || 0;
    const total = st.netPnl + rebate;
    const chrono = [...list].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
    let c = 0;
    const pts = [
      { label: "start", value: 0 },
      ...chrono.map((t, i) => {
        c += t.netPnl;
        return { label: `#${i + 1}`, value: c };
      }),
    ];
    return (
      <section key={st.dateKst} className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <button onClick={() => setOpen(expanded ? "" : st.dateKst)} className="flex flex-wrap items-center gap-2 text-left">
            <span className="text-[#9ca3af]">{expanded ? "▾" : "▸"}</span>
            <span className="font-medium">
              {weekday(st.dateKst)}, {st.dateKst}
            </span>
            <span className={`font-semibold ${st.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
              Net P&L {money(st.netPnl)}
            </span>
            {rebate ? <span className="text-sm text-[#5b45e0]">Rebate {money(rebate)}</span> : null}
            {rebate ? <span className="text-sm text-[#6b7280]">({money(total)})</span> : null}
          </button>
          <div className="flex items-center gap-2">
            {st.dateKst === today ? (
              <button
                onClick={syncToday}
                disabled={dayBusy || syncBusy}
                className="rounded-full bg-[#6d5cff] px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {dayBusy ? "Sync…" : "Start my day"}
              </button>
            ) : null}
            <button
              onClick={() => openNote(st.dateKst)}
              className="rounded-full border border-[#e5e7eb] px-3 py-1 text-xs text-[#6b7280]"
            >
              + Add note
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-[#f3f4f6] px-4 py-3 md:grid-cols-[260px_1fr]">
          <HoverAreaChart points={pts} baseline={0} height={160} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Stat k="Total Trades" v={String(st.trades)} />
            <Stat k="Gross P&L" v={money(extra.gross)} good={extra.gross} />
            <Stat k="Winners / Losers" v={`${st.wins} / ${st.losses}`} />
            <Stat k="Commissions" v={money(st.fee)} />
            <Stat k="Win Rate" v={`${(st.winRate * 100).toFixed(0)}%`} />
            <Stat k="Volume" v={extra.volume ? extra.volume.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} />
            <Stat k="Profit Factor" v={extra.pf == null ? "—" : extra.pf === Infinity ? "Inf" : extra.pf.toFixed(2)} />
            <Stat k="Rebate" v={money(rebate)} good={rebate} />
          </div>
        </div>
        {expanded ? tradeTable(list) : null}
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[#6b7280]">IMGBB Journal</p>
          <h1 className="mt-1 text-3xl font-semibold">Day View</h1>
          <div className="mt-3 inline-flex rounded-lg border border-[#e5e7eb] bg-white p-1">
            {(["day", "week"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 text-sm capitalize ${mode === m ? "bg-[#6d5cff] text-white" : "text-[#6b7280]"}`}
              >
                {m === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm"
          >
            {months.length === 0 ? <option value={today.slice(0, 7)}>{today.slice(0, 7)}</option> : null}
            {months.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button onClick={syncMonth} disabled={syncBusy} className="rounded-lg bg-[#6d5cff] px-4 py-2 text-sm text-white disabled:opacity-50">
            {syncBusy && !dayBusy ? "IMGBB…" : "IMGBB"}
          </button>
        </div>
      </div>
      {syncMsg ? <p className="mb-4 text-sm text-[#6d5cff]">{syncMsg}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 space-y-3">
          {mode === "day"
            ? dayCards.map(dayBlock)
            : weekCards.map((w) => {
                const expanded = open === w.start;
                const tradesList = w.list.flatMap((d) => byDate.get(d.dateKst) || []);
                let c = 0;
                const pts = [{ label: "start", value: 0 }].concat(
                  [...w.list].reverse().map((d) => {
                    c += d.netPnl;
                    return { label: d.dateKst.slice(8), value: c };
                  })
                );
                const extraTrades = w.list.flatMap((d) => byDate.get(d.dateKst) || []);
                const extra = enrich(extraTrades);
                return (
                  <section key={w.start} className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
                    <button onClick={() => setOpen(expanded ? "" : w.start)} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left">
                      <span className="text-[#9ca3af]">{expanded ? "▾" : "▸"}</span>
                      <span className="font-medium">
                        {w.start} – {w.end}
                      </span>
                      <span className={`font-semibold ${w.net >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                        Net P&L {money(w.net)}
                      </span>
                      {w.rebate ? <span className="text-sm text-[#5b45e0]">Rebate {money(w.rebate)}</span> : null}
                      {w.rebate ? <span className="text-sm text-[#6b7280]">({money(w.net + w.rebate)})</span> : null}
                    </button>
                    <div className="grid gap-4 border-t border-[#f3f4f6] px-4 py-3 md:grid-cols-[260px_1fr]">
                      <HoverAreaChart points={pts} baseline={0} height={160} />
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                        <Stat k="Total Trades" v={String(w.tradesN)} />
                        <Stat k="Gross P&L" v={money(extra.gross)} good={extra.gross} />
                        <Stat k="Winners / Losers" v={`${w.wins} / ${w.losses}`} />
                        <Stat k="Commissions" v={money(w.fee)} />
                        <Stat k="Win Rate" v={w.tradesN ? `${((w.wins / w.tradesN) * 100).toFixed(0)}%` : "—"} />
                        <Stat k="Days" v={String(w.list.length)} />
                        <Stat k="Profit Factor" v={extra.pf == null ? "—" : extra.pf === Infinity ? "Inf" : extra.pf.toFixed(2)} />
                        <Stat k="Rebate" v={money(w.rebate)} good={w.rebate} />
                      </div>
                    </div>
                    {expanded ? tradeTable(tradesList) : null}
                  </section>
                );
              })}
        </div>

        <aside className="h-fit w-full rounded-2xl border border-[#e5e7eb] bg-white p-3 shadow-sm lg:sticky lg:top-4">
          <div className="mb-2 text-center text-sm">{month}</div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[#9ca3af]">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}${i}`}>{d}</div>
            ))}
            {Array.from({ length: pad }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: count }).map((_, i) => {
              const day = String(i + 1).padStart(2, "0");
              const key = `${month}-${day}`;
              const st = statsMap.get(key);
              const win = Boolean(st && st.netPnl > 0);
              const loss = Boolean(st && st.netPnl < 0);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode("day");
                    setOpen(key);
                  }}
                  className={`rounded py-1 ${key === today ? "ring-1 ring-[#6d5cff] " : ""}${
                    win ? "bg-[#dcfce7] text-[#16a34a]" : loss ? "bg-[#fee2e2] text-[#ef4444]" : "text-[#9ca3af]"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {noteDate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setNoteDate(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium">Note · {noteDate}</h3>
            <textarea
              className="mt-3 h-36 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setNoteDate(null)} className="rounded-lg px-3 py-2 text-sm text-[#6b7280]">Cancel</button>
              <button onClick={saveNote} className="rounded-lg bg-[#6d5cff] px-3 py-2 text-sm text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}