"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats } from "@/lib/types";
import { money } from "@/lib/format";

export default function ProgressHome() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [rebates, setRebates] = useState<{ dateKst: string; amount: number }[]>([]);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/rebates").then((r) => r.json()).catch(() => ({ rebates: [] })),
    ]).then(([ov, rb]) => {
      const list: DayStats[] = ov.days || [];
      setDays(list);
      setRebates(rb.rebates || []);
      if (list.length) setYear(list[list.length - 1].dateKst.slice(0, 4));
    });
  }, []);

  const rebateMap = useMemo(() => new Map(rebates.map((r) => [r.dateKst, r.amount])), [rebates]);
  const years = useMemo(() => [...new Set(days.map((d) => d.dateKst.slice(0, 4)))].sort().reverse(), [days]);
  const months = useMemo(
    () => [...new Set(days.filter((d) => d.dateKst.startsWith(year)).map((d) => d.dateKst.slice(0, 7)))].sort().reverse(),
    [days, year]
  );

  const filtered = useMemo(() => {
    return days.filter((d) => {
      if (year && !d.dateKst.startsWith(year)) return false;
      if (month !== "all" && !d.dateKst.startsWith(month)) return false;
      return true;
    });
  }, [days, year, month]);

  const stats = useMemo(() => {
    const net = filtered.reduce((s, d) => s + d.netPnl, 0);
    const rebate = filtered.reduce((s, d) => s + (rebateMap.get(d.dateKst) || 0), 0);
    const trades = filtered.reduce((s, d) => s + d.trades, 0);
    const wins = filtered.reduce((s, d) => s + d.wins, 0);
    const winDays = filtered.filter((d) => d.netPnl > 0).length;
    const best = filtered.length ? filtered.reduce((a, b) => (a.netPnl >= b.netPnl ? a : b)) : null;
    const worst = filtered.length ? filtered.reduce((a, b) => (a.netPnl <= b.netPnl ? a : b)) : null;
    return { net, rebate, total: net + rebate, trades, wins, winDays, best, worst };
  }, [filtered, rebateMap]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-[#6b7280]">Progress</p>
      <h1 className="mt-1 text-3xl font-semibold">Tracker</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <select value={year} onChange={(e) => { setYear(e.target.value); setMonth("all"); }} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm">
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm">
          <option value="all">전체 월</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card k="Period Net" v={money(stats.net)} good={stats.net} />
        <Card k="Period Rebate" v={money(stats.rebate)} good={stats.rebate} />
        <Card k="Net + Rebate" v={money(stats.total)} good={stats.total} />
        <Card k="Win days" v={`${stats.winDays} / ${filtered.length}`} />
        <Card k="Trades" v={String(stats.trades)} />
        <Card k="Win rate" v={stats.trades ? `${((stats.wins / stats.trades) * 100).toFixed(0)}%` : "—"} />
        <Card k="Best day" v={stats.best ? `${stats.best.dateKst} ${money(stats.best.netPnl)}` : "—"} good={1} />
        <Card k="Worst day" v={stats.worst ? `${stats.worst.dateKst} ${money(stats.worst.netPnl)}` : "—"} good={-1} />
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="border-b border-[#e5e7eb] px-4 py-3 text-sm text-[#6b7280]">선택한 기간</div>
        {filtered.slice().reverse().map((d) => {
          const rb = rebateMap.get(d.dateKst) || 0;
          return (
            <a key={d.dateKst} href="/" className="flex items-center justify-between border-t border-[#f3f4f6] px-4 py-2 text-sm first:border-t-0">
              <span>{d.dateKst} · {d.trades}건</span>
              <span className="flex gap-3">
                {rb ? <span className="text-[#5b45e0]">R {money(rb)}</span> : null}
                <span className={d.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}>{money(d.netPnl)}</span>
              </span>
            </a>
          );
        })}
      </section>
    </main>
  );
}

function Card({ k, v, good }: { k: string; v: string; good?: number }) {
  const color = good == null ? "text-[#111827]" : good > 0 ? "text-[#16a34a]" : good < 0 ? "text-[#ef4444]" : "text-[#111827]";
  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 shadow-sm">
      <div className="text-xs text-[#6b7280]">{k}</div>
      <div className={`mt-1 text-sm font-semibold ${color}`}>{v}</div>
    </div>
  );
}