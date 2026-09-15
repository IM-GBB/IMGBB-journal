"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { daysInMonth, kstDateKey } from "@/lib/kst";
import type { DayStats } from "@/lib/types";

type Curve = { dateKst: string; netPnl: number; cum: number };
type Metric = "cum" | "pnl" | "winRate" | "trades" | "fee";

const METRICS: { id: Metric; label: string }[] = [
  { id: "cum", label: "누적 순손익" },
  { id: "pnl", label: "일별 순손익" },
  { id: "winRate", label: "승률" },
  { id: "trades", label: "매매 횟수" },
  { id: "fee", label: "수수료" },
];

function weekOfMonth(dateKst: string) {
  const y = Number(dateKst.slice(0, 4));
  const m = Number(dateKst.slice(5, 7));
  const d = Number(dateKst.slice(8, 10));
  const first = new Date(`${y}-${String(m).padStart(2, "0")}-01T12:00:00+09:00`);
  const pad = (first.getDay() + 6) % 7;
  return Math.floor((pad + d - 1) / 7) + 1;
}

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function sumDays(list: DayStats[]) {
  const trades = list.reduce((s, d) => s + d.trades, 0);
  const wins = list.reduce((s, d) => s + d.wins, 0);
  const losses = list.reduce((s, d) => s + d.losses, 0);
  const netPnl = list.reduce((s, d) => s + d.netPnl, 0);
  const fee = list.reduce((s, d) => s + d.fee, 0);
  const fundingFee = list.reduce((s, d) => s + d.fundingFee, 0);
  const realizedPnl = list.reduce((s, d) => s + d.realizedPnl, 0);
  return {
    trades,
    wins,
    losses,
    winRate: trades ? wins / trades : 0,
    netPnl,
    fee,
    fundingFee,
    realizedPnl,
  };
}

export default function CalendarHome() {
  const today = kstDateKey();
  const [days, setDays] = useState<DayStats[]>([]);
  const [curve, setCurve] = useState<Curve[]>([]);
  const [chartOpen, setChartOpen] = useState(false);
  const [metric, setMetric] = useState<Metric>("cum");
  const [year, setYear] = useState(today.slice(0, 4));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [week, setWeek] = useState(0);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((j) => {
        const list: DayStats[] = j.days || [];
        setDays(list);
        setCurve(j.curve || []);
        if (list.length) {
          const last = list[list.length - 1].dateKst;
          setYear(last.slice(0, 4));
          setMonth(last.slice(0, 7));
        }
      });
  }, []);

  const years = useMemo(
    () => [...new Set(days.map((d) => d.dateKst.slice(0, 4)))].sort(),
    [days]
  );
  const months = useMemo(
    () =>
      [...new Set(days.filter((d) => d.dateKst.startsWith(year)).map((d) => d.dateKst.slice(0, 7)))].sort(),
    [days, year]
  );
  const monthDays = useMemo(
    () => days.filter((d) => d.dateKst.startsWith(month)),
    [days, month]
  );
  const weeks = useMemo(
    () => [...new Set(monthDays.map((d) => weekOfMonth(d.dateKst)))].sort((a, b) => a - b),
    [monthDays]
  );
  const byDate = useMemo(() => new Map(days.map((d) => [d.dateKst, d])), [days]);

  useEffect(() => {
    if (months.length && !months.includes(month)) setMonth(months[months.length - 1]);
  }, [months, month]);
  useEffect(() => {
    if (week !== 0 && weeks.length && !weeks.includes(week)) setWeek(0);
  }, [weeks, week]);

  const y = Number(month.slice(0, 4)) || Number(today.slice(0, 4));
  const m = Number(month.slice(5, 7)) || Number(today.slice(5, 7));
  const count = daysInMonth(y, m);
  const first = new Date(`${y}-${String(m).padStart(2, "0")}-01T12:00:00+09:00`);
  const pad = (first.getDay() + 6) % 7;
  const monthSum = sumDays(monthDays);
  const yearDays = days.filter((d) => d.dateKst.startsWith(year));
  const yearCurve = curve.filter((c) => c.dateKst.startsWith(year));

  const chartPoints = useMemo(() => {
    return yearDays.map((d, i) => {
      const c = yearCurve.find((x) => x.dateKst === d.dateKst);
      const value =
        metric === "cum"
          ? c?.cum ?? 0
          : metric === "pnl"
            ? d.netPnl
            : metric === "winRate"
              ? d.winRate * 100
              : metric === "trades"
                ? d.trades
                : d.fee;
      return { i, date: d.dateKst, value };
    });
  }, [yearDays, yearCurve, metric]);

  const maxAbs = Math.max(1, ...chartPoints.map((p) => Math.abs(p.value)));
  const minV = Math.min(0, ...chartPoints.map((p) => p.value));
  const maxV = Math.max(0, ...chartPoints.map((p) => p.value));
  const span = Math.max(1, maxV - minV);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-[#8b95a5]">OKX Journal</p>
      <h1 className="mt-1 text-3xl font-semibold">
        {y}년 {m}월
      </h1>
      <p className="mt-2 text-sm text-[#8b95a5]">매매 기록이 있는 날짜만 선택할 수 있습니다. 오늘은 {today}.</p>

      <button
        onClick={() => setChartOpen((v) => !v)}
        className="mt-4 rounded-lg border border-[#2a313c] bg-[#14181e] px-4 py-2 text-sm"
      >
        {chartOpen ? "차트 닫기" : "차트 열기"}
      </button>

      {chartOpen ? (
        <section className="mt-3 rounded-xl border border-[#2a313c] bg-[#14181e] p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {METRICS.map((x) => (
              <button
                key={x.id}
                onClick={() => setMetric(x.id)}
                className={`rounded-lg px-3 py-1 text-xs ${
                  metric === x.id ? "bg-[#e8edf4] text-[#0b0d10]" : "border border-[#2a313c] text-[#c5ccd6]"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="mb-2 text-sm text-[#8b95a5]">{year}년 · {METRICS.find((x) => x.id === metric)?.label}</div>
          {chartPoints.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#8b95a5]">이 해 기록 없음</p>
          ) : (
            <svg viewBox="0 0 400 140" className="h-36 w-full">
              <line x1="0" y1={140 - ((0 - minV) / span) * 120 - 10} x2="400" y2={140 - ((0 - minV) / span) * 120 - 10} stroke="#2a313c" />
              {metric === "pnl" || metric === "fee" || metric === "trades" ? (
                chartPoints.map((p) => {
                  const x = (p.i / Math.max(chartPoints.length, 1)) * 400 + 4;
                  const h = (Math.abs(p.value) / maxAbs) * 50;
                  const zeroY = 70;
                  const y0 = p.value >= 0 ? zeroY - h : zeroY;
                  return (
                    <rect
                      key={p.date}
                      x={x}
                      y={y0}
                      width={Math.max(2, 360 / chartPoints.length)}
                      height={h}
                      fill={p.value >= 0 ? "#3dd68c" : "#f07178"}
                    />
                  );
                })
              ) : (
                <polyline
                  fill="none"
                  stroke="#3dd68c"
                  strokeWidth="2"
                  points={chartPoints
                    .map((p, idx) => {
                      const x = (idx / Math.max(chartPoints.length - 1, 1)) * 400;
                      const y = 130 - ((p.value - minV) / span) * 110;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              )}
            </svg>
          )}
        </section>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-[#8b95a5]">
          연
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-2 py-2 text-sm text-[#e8edf4]"
          >
            {years.length === 0 ? <option value={today.slice(0, 4)}>{today.slice(0, 4)}</option> : null}
            {years.map((v) => (
              <option key={v} value={v}>{v}년</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#8b95a5]">
          월
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-2 py-2 text-sm text-[#e8edf4]"
          >
            {months.length === 0 ? <option value={today.slice(0, 7)}>{today.slice(5, 7)}월</option> : null}
            {months.map((v) => (
              <option key={v} value={v}>{Number(v.slice(5, 7))}월</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#8b95a5]">
          주
          <select
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-2 py-2 text-sm text-[#e8edf4]"
          >
            <option value={0}>전체</option>
            {weeks.map((w) => (
              <option key={w} value={w}>{w}주차</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#8b95a5]">
          일
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) window.location.href = `/journal/${e.target.value}`;
            }}
            className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-2 py-2 text-sm text-[#e8edf4]"
          >
            <option value="">선택</option>
            {monthDays
              .filter((d) => week === 0 || weekOfMonth(d.dateKst) === week)
              .map((d) => (
                <option key={d.dateKst} value={d.dateKst}>
                  {d.dateKst.slice(8, 10)}일
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="mt-8 grid grid-cols-7 gap-2 text-center text-xs text-[#8b95a5]">
        {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
          <div key={d}>{d}</div>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: count }).map((_, i) => {
          const day = String(i + 1).padStart(2, "0");
          const key = `${y}-${String(m).padStart(2, "0")}-${day}`;
          const st = byDate.get(key);
          const inWeek = week === 0 || weekOfMonth(key) === week;
                  if (!st) {
            return (
              <Link
                key={key}
                href={`/journal/${key}`}
                className={`rounded-lg border border-[#1b2028] px-2 py-3 text-sm text-[#5b6472] ${
                  !inWeek ? "opacity-40" : ""
                }`}
              >
                {i + 1}
              </Link>
            );
          }
          const win = st.netPnl > 0;
          const loss = st.netPnl < 0;
          return (
            <Link
              key={key}
              href={`/journal/${key}`}
              className={`rounded-lg border px-2 py-3 text-sm ${
                !inWeek
                  ? "border-[#2a313c] text-[#5b6472] opacity-40"
                  : win
                    ? "border-[#3dd68c] bg-[#3dd68c22] text-[#3dd68c]"
                    : loss
                      ? "border-[#f07178] bg-[#f0717822] text-[#f07178]"
                      : "border-[#2a313c] text-[#c5ccd6]"
              }`}
            >
              {i + 1}
            </Link>
          );
        })}
      </div>

      <section className="mt-8 overflow-x-auto rounded-xl border border-[#2a313c]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#14181e] text-[#8b95a5]">
            <tr>
              {["기간", "매매", "승", "패", "승률", "실현", "수수료", "펀딩", "순손익"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-3">{m}월 합계</td>
              <td className="px-3 py-3">{monthSum.trades}</td>
              <td className="px-3 py-3 text-[#3dd68c]">{monthSum.wins}</td>
              <td className="px-3 py-3 text-[#f07178]">{monthSum.losses}</td>
              <td className="px-3 py-3">{(monthSum.winRate * 100).toFixed(0)}%</td>
              <td className="px-3 py-3">{won(monthSum.realizedPnl)}</td>
              <td className="px-3 py-3">{won(monthSum.fee)}</td>
              <td className="px-3 py-3">{won(monthSum.fundingFee)}</td>
              <td className={`px-3 py-3 ${monthSum.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>
                {won(monthSum.netPnl)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}