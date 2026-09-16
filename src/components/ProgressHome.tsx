"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats } from "@/lib/types";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function ProgressHome() {
  const [days, setDays] = useState<DayStats[]>([]);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((j) => setDays(j.days || []));
  }, []);

  const stats = useMemo(() => {
    if (!days.length) {
      return {
        streak: 0,
        loseStreak: 0,
        best: null as DayStats | null,
        worst: null as DayStats | null,
        totalNet: 0,
        totalTrades: 0,
        winDays: 0,
        thisMonth: 0,
        lastMonth: 0,
      };
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
    const totalTrades = days.reduce((s, d) => s + d.trades, 0);
    const winDays = days.filter((d) => d.netPnl > 0).length;
    const last = days[days.length - 1].dateKst.slice(0, 7);
    const [y, m] = last.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const thisMonth = days.filter((d) => d.dateKst.startsWith(last)).reduce((s, d) => s + d.netPnl, 0);
    const lastMonth = days.filter((d) => d.dateKst.startsWith(prev)).reduce((s, d) => s + d.netPnl, 0);
    return { streak, loseStreak, best, worst, totalNet, totalTrades, winDays, thisMonth, lastMonth, last, prev };
  }, [days]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-[#8b95a5]">Progress</p>
      <h1 className="mt-1 text-3xl font-semibold">Tracker</h1>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card k="Win streak" v={`${stats.streak}일`} />
        <Card k="Lose streak" v={`${stats.loseStreak}일`} />
        <Card k="All-time Net" v={won(stats.totalNet)} good={stats.totalNet} />
        <Card k="Win days" v={`${stats.winDays} / ${days.length}`} />
        <Card k="This month" v={won(stats.thisMonth)} good={stats.thisMonth} />
        <Card k="Last month" v={won(stats.lastMonth)} good={stats.lastMonth} />
        <Card k="Best day" v={stats.best ? `${stats.best.dateKst} ${won(stats.best.netPnl)}` : "—"} good={1} />
        <Card k="Worst day" v={stats.worst ? `${stats.worst.dateKst} ${won(stats.worst.netPnl)}` : "—"} good={-1} />
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-[#2a313c]">
        <div className="border-b border-[#2a313c] px-4 py-3 text-sm text-[#8b95a5]">최근 14일</div>
        <div className="divide-y divide-[#2a313c]">
          {days.slice(-14).reverse().map((d) => (
            <a key={d.dateKst} href={`/journal/${d.dateKst}`} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{d.dateKst} · {d.trades}건</span>
              <span className={d.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}>{won(d.netPnl)}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function Card({ k, v, good }: { k: string; v: string; good?: number }) {
  const color = good == null ? "" : good > 0 ? "text-[#3dd68c]" : good < 0 ? "text-[#f07178]" : "";
  return (
    <div className="rounded-xl border border-[#2a313c] bg-[#14181e] px-4 py-3">
      <div className="text-xs text-[#8b95a5]">{k}</div>
      <div className={`mt-1 text-sm font-medium ${color}`}>{v}</div>
    </div>
  );
}