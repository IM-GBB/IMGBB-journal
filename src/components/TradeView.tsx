"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Trade } from "@/lib/types";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const PAGE = 15;

export default function TradeView() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [q, setQ] = useState("");
  const [side, setSide] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/trades")
      .then((r) => r.json())
      .then((j) => setTrades(j.trades || []));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return trades
      .filter((t) => {
        if (side !== "all" && t.side !== side) return false;
        if (!s) return true;
        const blob = `${t.instId} ${t.dateKst} ${t.memo || ""} ${t.tags || ""} ${t.side}`.toLowerCase();
        return blob.includes(s);
      })
      .slice()
      .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  }, [trades, q, side]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE, cur * PAGE);

  useEffect(() => {
    setPage(1);
  }, [q, side]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-[#8b95a5]">Trade View</p>
      <h1 className="mt-1 text-3xl font-semibold">전체 매매</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="심볼, 날짜, 태그, 메모"
          className="w-64 rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value)}
          className="rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm"
        >
          <option value="all">all</option>
          <option value="long">long</option>
          <option value="short">short</option>
        </select>
        <span className="self-center text-sm text-[#8b95a5]">{filtered.length}건</span>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-[#2a313c]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="text-[#8b95a5]">
            <tr>
              {["Date", "Ticker", "Side", "Lev", "Net", "Tags"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#8b95a5]">없음</td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="border-t border-[#2a313c]">
                  <td className="px-3 py-2">
                    <Link href={`/journal/${t.dateKst}`} className="underline">
                      {t.dateKst}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{t.instId}</td>
                  <td className="px-3 py-2 uppercase">{t.side}</td>
                  <td className="px-3 py-2">{t.leverage ?? "—"}</td>
                  <td className={`px-3 py-2 ${t.netPnl >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(t.netPnl)}</td>
                  <td className="px-3 py-2 text-[#8b95a5]">{t.tags || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          disabled={cur <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-lg border border-[#2a313c] px-3 py-1 text-sm disabled:opacity-40"
        >
          이전
        </button>
        <span className="self-center text-sm text-[#8b95a5]">
          {cur} / {pages}
        </span>
        <button
          disabled={cur >= pages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-[#2a313c] px-3 py-1 text-sm disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </main>
  );
}