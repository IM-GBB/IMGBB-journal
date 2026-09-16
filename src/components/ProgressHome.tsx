"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats } from "@/lib/types";
import { money } from "@/lib/format";

export default function ProgressHome() {
  const [days, setDays] = useState<DayStats[]>([]);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((j) => setDays(j.days || []));
  }, []);

  const stats = useMemo(() => {
    if (!days.length) {
      return { streak: 0, loseStreak: 0, best: null as DayStats | null, worst: null as DayStats | null, totalNet: 0, winDays: 0, thisMonth: 0, lastMonth: 0 };
    }
    let streak = 0;
    let loseStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].netPnl > 0) streak += 1;
      else break;
    }
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].netPnl < 0) loseStreak += 1;
      else break;
    }
    const best = days.reduce((a, b) => (a.netPnl >= b.netPnl ? a : b));
    const worst = days.reduce((a, b) => (a.netPnl <= b.netPnl ? a : b));
    const totalNet = days.reduce((s, d) => s + d.netPnl, 0);
    const winDays = days.filter((d) => d.netPnl > 0).length;
    const last = days[days.length - 1].dateKst.slice(0, 7);
    const [y, m] = last.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return {
      streak,
      loseStreak,
      best,
      worst,
      totalNet,
      winDays,
      thisMonth: days.filter((d) => d.dateKst.startsWith(last)).reduce((s, d) => s + d.netPnl, 0),
      lastMonth: days.filter((d) => d.dateKst.startsWith(prev)).reduce((s, d) => s + d.netPnl, 0),
    };
  }, [days]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-[#6b7280]">Progress</p>
      <h1 className="mt-1 text-3xl font-semibold">Tracker</h1>
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card k="Win streak" v={`${stats.streak}일`} />
        <Card k="Lose streak" v={`${stats.loseStreak}일`} />
        <Card k="All-time Net" v={money(stats.totalNet)} good={stats.totalNet} />
        <Card k="Win days" v={`${stats.winDays} / ${days.length}`} />
        <Card k="This month" v={money(stats.thisMonth)} good={stats.thisMonth} />
        <Card k="Last month" v={money(stats.lastMonth)} good={stats.lastMonth} />
        <Card k="Best day" v={stats.best ? `${stats.best.dateKst} ${money(stats.best.netPnl)}` : "—"} good={1} />
        <Card k="Worst day" v={stats.worst ? `${stats.worst.dateKst} ${money(stats.worst.netPnl)}` : "—"} good={-1} />
      </section>
      <section className="mt-8 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="border-b border-[#e5e7eb] px-4 py-3 text-sm text-[#6b7280]">최근 14일</div>
        {days.slice(-14).reverse().map((d) => (
          <a key={d.dateKst} href={`/journal/${d.dateKst}`} className="flex items-center justify-between border-t border-[#f3f4f6] px-4 py-2 text-sm first:border-t-0">
            <span>{d.dateKst} · {d.trades}건</span>
            <span className={d.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}>{money(d.netPnl)}</span>
          </a>
        ))}
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