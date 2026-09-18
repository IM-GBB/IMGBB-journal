"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StockEntry } from "@/lib/stock-store";

function pct(n: number | null) {
  if (n == null) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default function StockList() {
  const [q, setQ] = useState("");
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<StockEntry[]>([]);

  useEffect(() => {
    const url = `/api/stock?q=${encodeURIComponent(q)}&page=${page}&pageSize=15`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        setItems(j.items || []);
        setPages(j.pages || 1);
        setTotal(j.total || 0);
      });
  }, [q, page]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(input.trim());
  }

  const headers = ["종목명", "원칙달성", "구분", "매매일", "매매비중", "수익률", "차트", "심리상태", "최종진단"];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-[#6b7280]">Stock Journal</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold">주식 매매일지</h1>
        <Link href="/stock/new" className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm shadow-sm">
          새로 쓰기
        </Link>
      </div>

      <form onSubmit={search} className="mt-5 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="검색: 종목 / 날짜 / 구분 / 심리"
          className="min-w-0 flex-1 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827]"
        />
        <button className="rounded-lg bg-[#6d5cff] px-4 py-2 text-sm text-white">검색</button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-[#6b7280]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-[#6b7280]"></td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t border-[#f3f4f6] hover:bg-[#f9fafb]">
                  <td className="px-3 py-3">
                    <Link href={`/stock/${it.id}`} className="font-medium hover:underline">
                      {it.name}
                    </Link>
                    {it.ticker ? <div className="text-xs text-[#6b7280]">{it.ticker}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-[#6b7280]">{it.principleRate}</td>
                  <td className="px-3 py-3">
                    {it.category ? <span className="rounded-md bg-[#f3f4f6] px-2 py-1 text-xs">{it.category}</span> : null}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {it.tradeDate}
                    {it.tradeDateEnd ? ` → ${it.tradeDateEnd}` : ""}
                  </td>
                  <td className="px-3 py-3">{it.weight}</td>
                  <td className={`px-3 py-3 ${(it.returnPct ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                    {pct(it.returnPct)}
                  </td>
                  <td className="px-3 py-3">
                    {it.chartImages[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.chartImages[0]} alt="" className="h-10 w-16 rounded object-cover" />
                    ) : (
                      <span className="text-[#9ca3af]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {it.psychology ? <span className="rounded-md bg-[#efeaff] px-2 py-1 text-xs text-[#5b45e0]">{it.psychology}</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    {it.diagnosis ? <span className="rounded-md bg-[#f3f4f6] px-2 py-1 text-xs">{it.diagnosis}</span> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-[#6b7280]">
        <span>총 {total}건 · {page}/{pages}페이지</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1 disabled:opacity-40">이전</button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1 disabled:opacity-40">다음</button>
        </div>
      </div>
    </main>
  );
}
