"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats, Trade } from "@/lib/types";
import HoverAreaChart from "@/components/HoverAreaChart";
import { money, tickerOf } from "@/lib/format";

export default function DashboardHome() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rebates, setRebates] = useState<{ dateKst: string; amount: number }[]>([]);
  const [range, setRange] = useState<"day" | "week" | "year">("day");

  useEffect(() => {
    Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/trades").then((r) => r.json()),
      fetch("/api/rebates").then((r) => r.json()).catch(() => ({ rebates: [] })),
    ]).then(([ov, tr, rb]) => {
      setDays(ov.days || []);
      setTrades(tr.trades || []);
      setRebates(rb.rebates || []);
    });
  }, []);

  const rebateMap = useMemo(() => new Map(rebates.map((r) => [r.dateKst, r.amount])), [rebates]);

  const series = useMemo(() => {
    let cum = 0;
    const daily = [{ label: "start", value: 0 }].concat(
      days.map((d) => {
        cum += d.netPnl + (rebateMap.get(d.dateKst) || 0);
        return { label: d.dateKst, value: cum };
      })
    );
    if (range === "day") return daily;
    if (range === "week") {
      const m = new Map<string, { label: string; value: number }>();
      for (const p of daily.slice(1)) {
        const d = new Date(`${p.label}T12:00:00+09:00`);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        m.set(key, { label: key, value: p.value });
      }
      return [{ label: "start", value: 0 }, ...m.values()];
    }
    const m = new Map<string, { label: string; value: number }>();
    for (const p of daily.slice(1)) m.set(p.label.slice(0, 4), { label: p.label.slice(0, 4), value: p.value });
    return [{ label: "start", value: 0 }, ...m.values()];
  }, [days, rebateMap, range]);

  const last = series[series.length - 1]?.value ?? 0;
  const month = days.length ? days[days.length - 1].dateKst.slice(0, 7) : "";
  const monthDays = days.filter((d) => d.dateKst.startsWith(month));
  const monthNet = monthDays.reduce((s, d) => s + d.netPnl, 0);
  const monthRebate = monthDays.reduce((s, d) => s + (rebateMap.get(d.dateKst) || 0), 0);
  const monthTrades = monthDays.reduce((s, d) => s + d.trades, 0);
  const monthWins = monthDays.reduce((s, d) => s + d.wins, 0);
  const allNet = days.reduce((s, d) => s + d.netPnl, 0);
  const allRebate = rebates.reduce((s, r) => s + r.amount, 0);
  const allTrades = days.reduce((s, d) => s + d.trades, 0);
  const winDays = days.filter((d) => d.netPnl > 0).length;

  const symbols = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trades) {
      const k = tickerOf(t.instId);
      m.set(k, (m.get(k) || 0) + t.netPnl);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [trades]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-[#6b7280]">IMGBB Journal</p>
      <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card k="Cumulative Net" v={money(last)} good={last} />
        <Card k="This month Net" v={money(monthNet)} good={monthNet} />
        <Card k="Fee rebate" v={money(allRebate)} good={allRebate} />
        <Card k="Win days" v={`${winDays}/${days.length || 0}`} />
        <Card k="Month trades" v={String(monthTrades)} />
        <Card k="Month win rate" v={monthTrades ? `${((monthWins / monthTrades) * 100).toFixed(0)}%` : "—"} />
        <Card k="All trades" v={String(allTrades)} />
        <Card k="Month rebate" v={money(monthRebate)} good={monthRebate} />
      </section>

      <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm text-[#6b7280]">Cumulative net P&L (from $0)</div>
            <div className="text-lg font-semibold">{money(last)}</div>
          </div>
          <div className="flex rounded-lg border border-[#e5e7eb] p-1">
            {(["day", "week", "year"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded px-3 py-1 text-sm capitalize ${range === r ? "bg-[#efeaff] text-[#5b45e0]" : "text-[#6b7280]"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <HoverAreaChart points={series} baseline={0} height={220} />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm text-[#6b7280]">Symbols</div>
          {symbols.map(([k, v]) => (
            <div key={k} className="flex justify-between border-t border-[#f3f4f6] py-2 text-sm first:border-t-0">
              <span>{k}</span>
              <span className={v >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}>{money(v)}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm text-[#6b7280]">Recent days</div>
          {days.slice(-8).reverse().map((d) => (
            <a key={d.dateKst} href={`/journal/${d.dateKst}`} className="flex justify-between border-t border-[#f3f4f6] py-2 text-sm first:border-t-0">
              <span>{d.dateKst}</span>
              <span className={d.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}>{money(d.netPnl)}</span>
            </a>
          ))}
        </div>
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