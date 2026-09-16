"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats, Trade } from "@/lib/types";
import HoverAreaChart from "@/components/HoverAreaChart";
import { money, tickerOf } from "@/lib/format";

export default function DashboardHome() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityNow, setEquityNow] = useState<number | null>(null);
  const [range, setRange] = useState<"day" | "week" | "year">("day");

  useEffect(() => {
    Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/trades").then((r) => r.json()),
      fetch("/api/account").then((r) => r.json()).catch(() => ({ equityUsd: null })),
    ]).then(([ov, tr, ac]) => {
      setDays(ov.days || []);
      setTrades(tr.trades || []);
      setEquityNow(typeof ac.equityUsd === "number" ? ac.equityUsd : null);
    });
  }, []);

  const equitySeries = useMemo(() => {
    let cum = 0;
    const rows = days.map((d) => {
      cum += d.netPnl;
      return { dateKst: d.dateKst, cum };
    });
    const total = cum;
    const eq = rows.map((r) => ({
      label: r.dateKst,
      value: equityNow != null ? equityNow - (total - r.cum) : r.cum,
    }));
    if (range === "day") return eq;
    if (range === "week") {
      const m = new Map<string, { label: string; value: number }>();
      for (const p of eq) {
        const d = new Date(`${p.label}T12:00:00+09:00`);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        const key = d.toISOString().slice(0, 10);
        m.set(key, { label: key, value: p.value });
      }
      return [...m.values()];
    }
    const m = new Map<string, { label: string; value: number }>();
    for (const p of eq) {
      const key = p.label.slice(0, 4);
      m.set(key, { label: key, value: p.value });
    }
    return [...m.values()];
  }, [days, equityNow, range]);

  const start = equitySeries[0]?.value ?? 0;
  const last = equitySeries[equitySeries.length - 1]?.value ?? 0;
  const month = days.length ? days[days.length - 1].dateKst.slice(0, 7) : "";
  const monthDays = days.filter((d) => d.dateKst.startsWith(month));
  const monthNet = monthDays.reduce((s, d) => s + d.netPnl, 0);
  const monthTrades = monthDays.reduce((s, d) => s + d.trades, 0);
  const monthWins = monthDays.reduce((s, d) => s + d.wins, 0);
  const allNet = days.reduce((s, d) => s + d.netPnl, 0);
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
        <Card k="Equity" v={equityNow != null ? money(equityNow) : money(last)} />
        <Card k="This month" v={money(monthNet)} good={monthNet} />
        <Card k="All-time Net" v={money(allNet)} good={allNet} />
        <Card k="Win days" v={`${winDays}/${days.length || 0}`} />
        <Card k="Month trades" v={String(monthTrades)} />
        <Card k="Month win rate" v={monthTrades ? `${((monthWins / monthTrades) * 100).toFixed(0)}%` : "—"} />
        <Card k="All trades" v={String(allTrades)} />
        <Card k="From start" v={money(last - start)} good={last - start} />
      </section>

      <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm text-[#6b7280]">Equity curve</div>
            <div className="text-lg font-semibold">{equityNow != null ? money(equityNow) : money(last)}</div>
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
        <HoverAreaChart points={equitySeries} baseline={start} height={220} />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm text-[#6b7280]">Top / bottom symbols</div>
          {(symbols.slice(0, 3).concat(symbols.slice(-3).reverse())).filter((v, i, a) => a.findIndex((x) => x[0] === v[0]) === i).slice(0, 6).map(([k, v]) => (
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
  const color = good == null ? "" : good > 0 ? "text-[#16a34a]" : good < 0 ? "text-[#ef4444]" : "";
  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 shadow-sm">
      <div className="text-xs text-[#6b7280]">{k}</div>
      <div className={`mt-1 font-semibold ${color}`}>{v}</div>
    </div>
  );
}