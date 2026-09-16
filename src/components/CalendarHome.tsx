"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { daysInMonth, kstDateKey } from "@/lib/kst";
import type { DayStats, Trade } from "@/lib/types";

function won(n: number, digits = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function tickerOf(instId: string) {
  return instId.replace("-SWAP", "").replace("-USDT", "USDT").replace(/-/g, "");
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

function weekday(dateKst: string) {
  const d = new Date(`${dateKst}T12:00:00+09:00`);
  return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
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

function roi(t: Trade) {
  if (t.openAvgPx && t.size && t.leverage) {
    const margin = (t.size * t.openAvgPx) / t.leverage;
    if (margin) return (t.netPnl / margin) * 100;
  }
  return null;
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
    return { x, y, v };
  });
  const d = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const last = coords[coords.length - 1];
  const zeroY = h - 6 - ((0 - min) / span) * (h - 12);
  const area = `${d} L${last.x},${zeroY} L${coords[0].x},${zeroY} Z`;
  const up = (last?.v ?? 0) >= 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-28">
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#2a313c" />
      <path d={area} fill={up ? "#3dd68c22" : "#f0717822"} />
      <path d={d} fill="none" stroke={up ? "#3dd68c" : "#f07178"} strokeWidth="1.6" />
    </svg>
  );
}

function Stat({ k, v, good }: { k: string; v: string; good?: number }) {
  const color = good == null ? "" : good > 0 ? "text-[#3dd68c]" : good < 0 ? "text-[#f07178]" : "";
  return (
    <div>
      <div className="text-[11px] text-[#8b95a5]">{k}</div>
      <div className={`font-medium ${color}`}>{v}</div>
    </div>
  );
}

export default function CalendarHome() {
  const today = kstDateKey();
  const [days, setDays] = useState<DayStats[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [open, setOpen] = useState<string>(today);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  async function reload() {
    const [ov, tr] = await Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/trades").then((r) => r.json()),
    ]);
    const list: DayStats[] = ov.days || [];
    setDays(list);
    setTrades(tr.trades || []);
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
        setSyncMsg(json.error || `${date} 실패`);
        setSyncBusy(false);
        return;
      }
      ok += 1;
      added += json.synced || 0;
    }
    setSyncBusy(false);
    setSyncMsg(`${ok}일 완료 · ${added}건`);
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[#8b95a5]">Day View</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {y}년 {mo}월
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#2a313c] p-1">
            <button
              onClick={() => setMode("day")}
              className={`rounded px-3 py-1 text-sm ${mode === "day" ? "bg-[#e8edf4] text-[#0b0d10]" : ""}`}
            >
              Day
            </button>
            <button
              onClick={() => setMode("week")}
              className={`rounded px-3 py-1 text-sm ${mode === "week" ? "bg-[#e8edf4] text-[#0b0d10]" : ""}`}
            >
              Week
            </button>
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
          >
            {months.length === 0 ? <option value={today.slice(0, 7)}>{today.slice(0, 7)}</option> : null}
            {months.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            onClick={syncMonth}
            disabled={syncBusy}
            className="rounded-lg bg-[#e8edf4] px-4 py-2 text-sm text-[#0b0d10] disabled:opacity-50"
          >
            {syncBusy ? "동기화 중…" : "이번 달 동기화"}
          </button>
        </div>
      </div>
      {syncMsg ? <p className="mb-4 text-sm text-[#f0c674]">{syncMsg}</p> : null}

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
                    <button
                      onClick={() => setOpen(expanded ? "" : wk)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="font-medium">
                        {expanded ? "▾" : "▸"} 주 {wk} ~
                      </span>
                      <span className={net >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}>Net {won(net)}</span>
                    </button>
                    {expanded ? (
                      <div className="border-t border-[#2a313c] px-4 pb-4 pt-3">
                        <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          <Stat k="Days" v={String(list.length)} />
                          <Stat k="Trades" v={String(n)} />
                          <Stat k="Wins" v={String(wins)} />
                          <Stat k="PF" v={extra.pf == null ? "—" : extra.pf === Infinity ? "Inf" : extra.pf.toFixed(2)} />
                        </div>
                        {list.map((d) => (
                          <Link key={d.dateKst} href={`/journal/${d.dateKst}`} className="flex justify-between border-t border-[#2a313c] py-2 text-sm">
                            <span>
                              {weekday(d.dateKst)} {d.dateKst}
                            </span>
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
                    <button
                      onClick={() => setOpen(expanded ? "" : st.dateKst)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#8b95a5]">{expanded ? "▾" : "▸"}</span>
                        <span className="font-medium">
                          {weekday(st.dateKst)} {st.dateKst.slice(8, 10)}일
                        </span>
                        <span className="text-xs text-[#8b95a5]">{st.dateKst}</span>
                      </div>
                      <span className={`font-medium ${pos ? "text-[#3dd68c]" : "text-[#f07178]"}`}>Net {won(st.netPnl)}</span>
                    </button>
                    {expanded ? (
                      <div className="border-t border-[#2a313c] px-4 pb-4 pt-3">
                        <div className="mb-4 flex flex-wrap items-center gap-6">
                          <MiniCurve trades={[...list].reverse()} />
                          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
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
                        <div className="overflow-x-auto rounded-lg border border-[#2a313c]">
                          <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="text-xs text-[#8b95a5]">
                              <tr>
                                {["Open time", "Ticker", "Side", "Instrument", "Net P&L", "Net ROI"].map((h) => (
                                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {list.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-3 py-6 text-center text-[#8b95a5]">매매 없음</td>
                                </tr>
                              ) : (
                                list.map((t) => {
                                  const r = roi(t);
                                  return (
                                    <tr key={t.id} className="border-t border-[#2a313c]">
                                      <td className="px-3 py-2 whitespace-nowrap text-[#8b95a5]">{hhmm(t.closedAt)}</td>
                                      <td className="px-3 py-2">
                                        <Link href={`/journal/${t.dateKst}`} className="rounded-full bg-[#1b2028] px-2 py-0.5 text-xs">
                                          {tickerOf(t.instId)}
                                        </Link>
                                      </td>
                                      <td className="px-3 py-2 uppercase">{t.side}</td>
                                      <td className="px-3 py-2 text-[#8b95a5]">{tickerOf(t.instId)}</td>
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
                        <div className="mt-3">
                          <Link href={`/journal/${st.dateKst}`} className="text-xs text-[#8b95a5] underline">이 날 상세</Link>
                        </div>
                      </div>
                    ) : null}
                  </section>
                );
              })}
        </div>

        <aside className="h-fit rounded-xl border border-[#2a313c] bg-[#14181e] p-3">
          <div className="mb-2 text-center text-sm">
            {y}년 {mo}월
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[#8b95a5]">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d}>{d}</div>
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