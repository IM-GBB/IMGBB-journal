"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { daysInMonth, kstDateKey } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";
import HoverAreaChart from "@/components/HoverAreaChart";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function weekday(dateKst: string) {
  const d = new Date(`${dateKst}T12:00:00+09:00`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

function mondayOf(dateKst: string) {
  const d = new Date(`${dateKst}T12:00:00+09:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function enrich(list: Trade[]) {
  const volume = list.reduce((s, t) => s + (t.size || 0), 0);
  const gross = list.reduce((s, t) => s + t.netPnl - t.fee - t.fundingFee, 0);
  const winSum = list.filter((t) => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
  const loseSum = list.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0);
  const pf = loseSum < 0 ? winSum / Math.abs(loseSum) : winSum > 0 ? Infinity : null;
  return { volume, gross, pf };
}

function MiniCurve({ trades }: { trades: Trade[] }) {
  let c = 0;
  const pts = trades.map((t) => {
    c += t.netPnl;
    return c;
  });
  if (!pts.length) return <div className="h-16 w-28 rounded bg-[#1b2028]" />;
  const min = Math.min(0, ...pts);
  const max = Math.max(0, ...pts);
  const span = Math.max(1, max - min);
  const w = 120;
  const h = 64;
  const coords = pts.map((v, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * (w - 4) + 2;
    const y = h - 6 - ((v - min) / span) * (h - 12);
    return { x, y };
  });
  const d = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const last = coords[coords.length - 1];
  const zeroY = h - 6 - ((0 - min) / span) * (h - 12);
  const area = `${d} L${last.x},${zeroY} L${coords[0].x},${zeroY} Z`;
  const up = (pts[pts.length - 1] ?? 0) >= 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-28">
      <defs>
        <linearGradient id="miniUp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3dd68c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3dd68c" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="miniDn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f07178" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f07178" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#2a313c" />
      <path d={area} fill={up ? "url(#miniUp)" : "url(#miniDn)"} />
      <path d={d} fill="none" stroke={up ? "#3dd68c" : "#f07178"} strokeWidth="1.6" />
    </svg>
  );
}

function Stat({ k, v, good }: { k: string; v: string; good?: number }) {
  const color = good == null ? "" : good > 0 ? "text-[#3dd68c]" : good < 0 ? "text-[#f07178]" : "";
  return (
    <div>
      <div className="text-[11px] text-[#8b95a5]">{k}</div>
      <div className={`text-sm font-medium ${color}`}>{v}</div>
    </div>
  );
}

export default function CalendarHome() {
  const today = kstDateKey();
  const [days, setDays] = useState<DayStats[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityNow, setEquityNow] = useState<number | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [open, setOpen] = useState<string>(today);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [chartOpen, setChartOpen] = useState(true);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  async function reload() {
    const [ov, tr, ac] = await Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/trades").then((r) => r.json()),
      fetch("/api/account").then((r) => r.json()).catch(() => ({ equityUsd: null })),
    ]);
    const list: DayStats[] = ov.days || [];
    setDays(list);
    setTrades(tr.trades || []);
    setEquityNow(typeof ac.equityUsd === "number" ? ac.equityUsd : null);
    if (list.length) {
      const last = list[list.length - 1].dateKst;
      setMonth(last.slice(0, 7));
      setOpen(last);
    }
  }

  useEffect(() => {
    reload();
  }, []);

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

  const equityPoints = useMemo(() => {
    let cum = 0;
    const rows = days.map((d) => {
      cum += d.netPnl;
      return { dateKst: d.dateKst, cum };
    });
    const total = cum;
    return rows.map((r) => ({
      label: r.dateKst,
      value: equityNow != null ? equityNow - (total - r.cum) : r.cum,
    }));
  }, [days, equityNow]);

  const seedStart = equityPoints.length ? equityPoints[0].value : 0;

  const weeks = useMemo(() => {
    const map = new Map<string, DayStats[]>();
    for (const d of monthDays) {
      const key = mondayOf(d.dateKst);
      const arr = map.get(key) || [];
      arr.push(d);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthDays]);

  async function syncMonth() {
    const todayKey = kstDateKey();
    const last = month === todayKey.slice(0, 7) ? Number(todayKey.slice(8, 10)) : count;
    setSyncBusy(true);
    setSyncMsg("");
    let ok = 0;
    let added = 0;
    for (let d = 1; d <= last; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      setSyncMsg(`${date} ${d}/${last}`);
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSyncMsg(json.error || `${date} failed`);
        setSyncBusy(false);
        return;
      }
      ok += 1;
      added += json.synced || 0;
    }
    setSyncBusy(false);
    setSyncMsg(`${ok} days · ${added} trades`);
    await reload();
  }

  const cards: DayStats[] =
    monthDays.length > 0
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
            },
          ]
        : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[#8b95a5]">Day View</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {y}-{String(mo).padStart(2, "0")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setChartOpen((v) => !v)}
            className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
          >
            {chartOpen ? "Hide equity" : "Show equity"}
          </button>
          <div className="flex rounded-lg border border-[#2a313c] p-1">
            <button onClick={() => setMode("day")} className={`rounded px-3 py-1 text-sm ${mode === "day" ? "bg-[#e8edf4] text-[#0b0d10]" : ""}`}>Day</button>
            <button onClick={() => setMode("week")} className={`rounded px-3 py-1 text-sm ${mode === "week" ? "bg-[#e8edf4] text-[#0b0d10]" : ""}`}>Week</button>
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
          >
            {months.length === 0 ? <option value={today.slice(0, 7)}>{today.slice(0, 7)}</option> : null}
            {months.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button onClick={syncMonth} disabled={syncBusy} className="rounded-lg bg-[#e8edf4] px-4 py-2 text-sm text-[#0b0d10] disabled:opacity-50">
            {syncBusy ? "Syncing…" : "Sync month"}
          </button>
        </div>
      </div>
      {syncMsg ? <p className="mb-4 text-sm text-[#f0c674]">{syncMsg}</p> : null}

      {chartOpen ? (
        <section className="mb-6 rounded-xl border border-[#2a313c] bg-[#14181e] p-4">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="text-sm text-[#8b95a5]">Equity</div>
            <div className="text-sm">
              {equityNow != null ? won(equityNow) : equityPoints.length ? won(equityPoints[equityPoints.length - 1].value) : "—"}
            </div>
          </div>
          <HoverAreaChart points={equityPoints} baseline={seedStart} />
          <p className="mt-1 text-[11px] text-[#8b95a5]">
            {equityNow != null
              ? "Hover a day for estimated balance. Reconstructed from current OKX equity minus later realized PnL."
              : "OKX equity unavailable. Showing cumulative realized PnL instead."}
          </p>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          {mode === "week"
            ? weeks.map(([wk, list]) => {
                const net = list.reduce((s, d) => s + d.netPnl, 0);
                const n = list.reduce((s, d) => s + d.trades, 0);
                const wins = list.reduce((s, d) => s + d.wins, 0);
                const expanded = open === wk;
                const tradesW = list.flatMap((d) => byDate.get(d.dateKst) || []);
                const extra = enrich(tradesW);
                return (
                  <section key={wk} className="overflow-hidden rounded-xl border border-[#2a313c] bg-[#14181e]">
                    <button onClick={() => setOpen(expanded ? "" : wk)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="font-medium">{expanded ? "▾" : "▸"} Week of {wk}</span>
                      <span className={net >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}>Net {won(net)}</span>
                    </button>
                    {expanded ? (
                      <div className="border-t border-[#2a313c] px-4 pb-4 pt-3">
                        <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          <Stat k="Days" v={String(list.length)} />
                          <Stat k="Trades" v={String(n)} />
                          <Stat k="Wins" v={String(wins)} />
                          <Stat k="Profit Factor" v={extra.pf == null ? "—" : extra.pf === Infinity ? "Inf" : extra.pf.toFixed(2)} />
                        </div>
                        {list.map((d) => (
                          <Link key={d.dateKst} href={`/journal/${d.dateKst}`} className="flex justify-between border-t border-[#2a313c] py-2 text-sm">
                            <span>{weekday(d.dateKst)} {d.dateKst}</span>
                            <span className={d.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}>{won(d.netPnl)}</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })
            : cards.map((st) => {
                const list = byDate.get(st.dateKst) || [];
                const extra = enrich(list);
                const expanded = open === st.dateKst;
                const pos = st.netPnl >= 0;
                return (
                  <section key={st.dateKst} className="overflow-hidden rounded-xl border border-[#2a313c] bg-[#14181e]">
                    <button onClick={() => setOpen(expanded ? "" : st.dateKst)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-[#8b95a5]">{expanded ? "▾" : "▸"}</span>
                        <span className="font-medium">{weekday(st.dateKst)}, {st.dateKst}</span>
                      </div>
                      <span className={`font-medium ${pos ? "text-[#3dd68c]" : "text-[#f07178]"}`}>Net P&L {won(st.netPnl)}</span>
                    </button>
                    {expanded ? (
                      <div className="border-t border-[#2a313c] px-4 pb-4 pt-3">
                        <div className="mb-3 flex flex-wrap items-center gap-6">
                          <MiniCurve trades={[...list].reverse()} />
                          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                            <Stat k="Total Trades" v={String(st.trades)} />
                            <Stat k="Gross P&L" v={won(extra.gross)} good={extra.gross} />
                            <Stat k="Winners / Losers" v={`${st.wins} / ${st.losses}`} />
                            <Stat k="Commissions" v={won(st.fee)} />
                            <Stat k="Win Rate" v={`${(st.winRate * 100).toFixed(0)}%`} />
                            <Stat k="Volume" v={extra.volume ? extra.volume.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} />
                            <Stat k="Profit Factor" v={extra.pf == null ? "—" : extra.pf === Infinity ? "Inf" : extra.pf.toFixed(2)} />
                            <Stat k="Net P&L" v={won(st.netPnl)} good={st.netPnl} />
                          </div>
                        </div>
                        <Link href={`/journal/${st.dateKst}`} className="text-xs text-[#8b95a5] underline">
                          Day details
                        </Link>
                      </div>
                    ) : null}
                  </section>
                );
              })}
        </div>

        <aside className="h-fit rounded-xl border border-[#2a313c] bg-[#14181e] p-3">
          <div className="mb-2 text-center text-sm">{y}-{String(mo).padStart(2, "0")}</div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[#8b95a5]">
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
              const isToday = key === today;
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
                  className={`rounded py-1 ${isToday ? "ring-1 ring-[#e8edf4] " : ""}${
                    win ? "bg-[#3dd68c22] text-[#3dd68c]" : loss ? "bg-[#f0717822] text-[#f07178]" : "text-[#8b95a5]"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </main>
  );
}