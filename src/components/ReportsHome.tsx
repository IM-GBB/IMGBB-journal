"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats, Trade } from "@/lib/types";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function tickerOf(instId: string) {
  return instId.replace("-SWAP", "").replace(/-/g, "");
}

function weekday(dateKst: string) {
  return new Date(`${dateKst}T12:00:00+09:00`).getDay();
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];

export default function ReportsHome() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [month, setMonth] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/overview").then((r) => r.json()), fetch("/api/trades").then((r) => r.json())]).then(
      ([ov, tr]) => {
        const list: DayStats[] = ov.days || [];
        setDays(list);
        setTrades(tr.trades || []);
        if (list.length) setMonth(list[list.length - 1].dateKst.slice(0, 7));
      }
    );
  }, []);

  const months = useMemo(
    () => [...new Set(days.map((d) => d.dateKst.slice(0, 7)))].sort().reverse(),
    [days]
  );

  const monthDays = useMemo(() => days.filter((d) => d.dateKst.startsWith(month)), [days, month]);
  const monthTrades = useMemo(() => trades.filter((t) => t.dateKst.startsWith(month)), [trades, month]);

  const summary = useMemo(() => {
    const t = monthTrades;
    const wins = t.filter((x) => x.netPnl > 0);
    const losses = t.filter((x) => x.netPnl < 0);
    const winSum = wins.reduce((s, x) => s + x.netPnl, 0);
    const loseSum = losses.reduce((s, x) => s + x.netPnl, 0);
    const net = t.reduce((s, x) => s + x.netPnl, 0);
    const fee = t.reduce((s, x) => s + x.fee, 0);
    const pf = loseSum < 0 ? winSum / Math.abs(loseSum) : winSum > 0 ? Infinity : null;
    return {
      trades: t.length,
      days: monthDays.length,
      wins: wins.length,
      losses: losses.length,
      winRate: t.length ? wins.length / t.length : 0,
      net,
      fee,
      pf,
    };
  }, [monthTrades, monthDays.length]);

  const bySymbol = useMemo(() => {
    const m = new Map<string, { n: number; net: number; wins: number }>();
    for (const t of monthTrades) {
      const k = tickerOf(t.instId);
      const cur = m.get(k) || { n: 0, net: 0, wins: 0 };
      cur.n += 1;
      cur.net += t.netPnl;
      if (t.netPnl > 0) cur.wins += 1;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => a[1].net - b[1].net);
  }, [monthTrades]);

  const byWeekday = useMemo(() => {
    return WD.map((label, i) => {
      const list = monthTrades.filter((t) => weekday(t.dateKst) === i);
      const net = list.reduce((s, t) => s + t.netPnl, 0);
      const wins = list.filter((t) => t.netPnl > 0).length;
      return { label, n: list.length, net, winRate: list.length ? wins / list.length : 0 };
    });
  }, [monthTrades]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-[#8b95a5]">Reports</p>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold">{month || "—"}</h1>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card k="Net P&L" v={won(summary.net)} good={summary.net} />
        <Card k="Trades" v={String(summary.trades)} />
        <Card k="Win Rate" v={`${(summary.winRate * 100).toFixed(0)}%`} />
        <Card k="W / L" v={`${summary.wins} / ${summary.losses}`} />
        <Card k="Fees" v={won(summary.fee)} />
        <Card k="Days" v={String(summary.days)} />
        <Card k="Profit Factor" v={summary.pf == null ? "—" : summary.pf === Infinity ? "Inf" : summary.pf.toFixed(2)} />
        <Card k="Avg / trade" v={summary.trades ? won(summary.net / summary.trades) : "—"} good={summary.net} />
      </section>

      <section className="mb-8 overflow-x-auto rounded-xl border border-[#2a313c]">
        <div className="border-b border-[#2a313c] px-4 py-3 text-sm text-[#8b95a5]">심볼</div>
        <table className="w-full text-left text-sm">
          <thead className="text-[#8b95a5]">
            <tr>
              <th className="px-4 py-2 font-medium">Ticker</th>
              <th className="px-4 py-2 font-medium">N</th>
              <th className="px-4 py-2 font-medium">Win%</th>
              <th className="px-4 py-2 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {bySymbol.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[#8b95a5]">
                  없음
                </td>
              </tr>
            ) : (
              bySymbol.map(([k, v]) => (
                <tr key={k} className="border-t border-[#2a313c]">
                  <td className="px-4 py-2">{k}</td>
                  <td className="px-4 py-2">{v.n}</td>
                  <td className="px-4 py-2">{((v.wins / v.n) * 100).toFixed(0)}%</td>
                  <td className={`px-4 py-2 ${v.net >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(v.net)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-[#2a313c]">
        <div className="border-b border-[#2a313c] px-4 py-3 text-sm text-[#8b95a5]">요일</div>
        <table className="w-full text-left text-sm">
          <thead className="text-[#8b95a5]">
            <tr>
              <th className="px-4 py-2 font-medium">Day</th>
              <th className="px-4 py-2 font-medium">N</th>
              <th className="px-4 py-2 font-medium">Win%</th>
              <th className="px-4 py-2 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {byWeekday.map((r) => (
              <tr key={r.label} className="border-t border-[#2a313c]">
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2">{r.n}</td>
                <td className="px-4 py-2">{r.n ? `${(r.winRate * 100).toFixed(0)}%` : "—"}</td>
                <td className={`px-4 py-2 ${r.net >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Card({ k, v, good }: { k: string; v: string; good?: number }) {
  const color = good == null ? "" : good > 0 ? "text-[#3dd68c]" : good < 0 ? "text-[#f07178]" : "";
  return (
    <div className="rounded-xl border border-[#2a313c] bg-[#14181e] px-4 py-3">
      <div className="text-xs text-[#8b95a5]">{k}</div>
      <div className={`mt-1 text-lg font-medium ${color}`}>{v}</div>
    </div>
  );
}