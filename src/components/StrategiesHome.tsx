"use client";

import { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/lib/types";

function won(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function tagsOf(t: Trade) {
  return (t.tags || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function StrategiesHome() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    fetch("/api/trades")
      .then((r) => r.json())
      .then((j) => setTrades(j.trades || []));
  }, []);

  const rows = useMemo(() => {
    const m = new Map<string, { n: number; wins: number; net: number }>();
    let untagged = { n: 0, wins: 0, net: 0 };
    for (const t of trades) {
      const tags = tagsOf(t);
      if (!tags.length) {
        untagged.n += 1;
        untagged.net += t.netPnl;
        if (t.netPnl > 0) untagged.wins += 1;
        continue;
      }
      for (const tag of tags) {
        const cur = m.get(tag) || { n: 0, wins: 0, net: 0 };
        cur.n += 1;
        cur.net += t.netPnl;
        if (t.netPnl > 0) cur.wins += 1;
        m.set(tag, cur);
      }
    }
    const list = [...m.entries()].map(([tag, v]) => ({ tag, ...v }));
    list.sort((a, b) => b.net - a.net);
    return { list, untagged };
  }, [trades]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-[#8b95a5]">Strategies</p>
      <h1 className="mt-1 text-3xl font-semibold">태그별</h1>
      <p className="mt-2 text-sm text-[#8b95a5]">매매 상세에서 태그를 저장해야 여기에 쌓인다.</p>

      <section className="mt-6 overflow-x-auto rounded-xl border border-[#2a313c]">
        <table className="w-full text-left text-sm">
          <thead className="text-[#8b95a5]">
            <tr>
              <th className="px-4 py-2 font-medium">Tag</th>
              <th className="px-4 py-2 font-medium">N</th>
              <th className="px-4 py-2 font-medium">Win%</th>
              <th className="px-4 py-2 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#8b95a5]">
                  태그 없음. 일지에서 행을 열고 태그를 저장해라.
                </td>
              </tr>
            ) : (
              rows.list.map((r) => (
                <tr key={r.tag} className="border-t border-[#2a313c]">
                  <td className="px-4 py-2">{r.tag}</td>
                  <td className="px-4 py-2">{r.n}</td>
                  <td className="px-4 py-2">{((r.wins / r.n) * 100).toFixed(0)}%</td>
                  <td className={`px-4 py-2 ${r.net >= 0 ? "text-[#3dd68c]" : "text-[#f07178]"}`}>{won(r.net)}</td>
                </tr>
              ))
            )}
            <tr className="border-t border-[#2a313c] text-[#8b95a5]">
              <td className="px-4 py-2">untagged</td>
              <td className="px-4 py-2">{rows.untagged.n}</td>
              <td className="px-4 py-2">
                {rows.untagged.n ? `${((rows.untagged.wins / rows.untagged.n) * 100).toFixed(0)}%` : "—"}
              </td>
              <td className="px-4 py-2">{won(rows.untagged.net)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}