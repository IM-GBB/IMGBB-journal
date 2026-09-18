"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats } from "@/lib/types";
import { daysInMonth, kstDateKey } from "@/lib/kst";
import { money, weekday } from "@/lib/format";

type NoteRow = { date: string; note: string };
type Memo = { id: string; body: string; createdAt: string };

export default function NotebookHome() {
  const today = kstDateKey();
  const [days, setDays] = useState<DayStats[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState(today);
  const [page, setPage] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/day-note").then((r) => r.json()),
      fetch("/api/memos").then((r) => r.json()).catch(() => ({ memos: [] })),
    ]).then(([ov, dn, mm]) => {
      const list: DayStats[] = ov.days || [];
      setDays(list);
      setNotes(dn.notes || []);
      setMemos(mm.memos || []);
      if (list.length) setMonth(list[list.length - 1].dateKst.slice(0, 7));
    });
  }, []);

  const byDate = useMemo(() => new Map(days.map((d) => [d.dateKst, d])), [days]);
  const noteMap = useMemo(() => new Map(notes.map((n) => [n.date, n.note])), [notes]);
  const months = useMemo(
    () => [...new Set([...days.map((d) => d.dateKst.slice(0, 7)), today.slice(0, 7)])].sort().reverse(),
    [days, today]
  );

  const y = Number(month.slice(0, 4));
  const mo = Number(month.slice(5, 7));
  const count = daysInMonth(y, mo);
  const first = new Date(`${month}-01T12:00:00+09:00`);
  const pad = first.getDay();
  const selectedNote = noteMap.get(picked) || "";
  const selectedStats = byDate.get(picked);

  const per = 10;
  const pages = Math.max(1, Math.ceil(memos.length / per));
  const slice = memos.slice(page * per, page * per + per);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-[#6b7280]">Notebook</p>
      <h1 className="mt-1 text-3xl font-semibold">Daily notes</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-2xl border border-[#e5e7eb] bg-white p-3 shadow-sm">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mb-3 w-full rounded-lg border border-[#e5e7eb] px-2 py-1 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[#9ca3af]">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}${i}`}>{d}</div>
            ))}
            {Array.from({ length: pad }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: count }).map((_, i) => {
              const key = `${month}-${String(i + 1).padStart(2, "0")}`;
              const has = Boolean(noteMap.get(key));
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPicked(key)}
                  className={`rounded py-1 ${picked === key ? "ring-1 ring-[#6d5cff] " : ""}${
                    has ? "bg-[#efeaff] text-[#5b45e0]" : "text-[#9ca3af]"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-[#6b7280]">연보라 = 노트 있는 날</p>
        </aside>

        <article className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">
              {weekday(picked)}, {picked}
            </h2>
            <span className={selectedStats && selectedStats.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}>
              {selectedStats ? money(selectedStats.netPnl) : ""}
            </span>
          </div>
          {selectedStats ? (
            <p className="mt-1 text-xs text-[#6b7280]">
              {selectedStats.trades} trades · wr {(selectedStats.winRate * 100).toFixed(0)}% · fees {money(selectedStats.fee)}
            </p>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap text-sm">{selectedNote || "이 날 노트가 없습니다."}</p>
          <a href="/" className="mt-3 inline-block text-xs text-[#6d5cff]">Open in Day View</a>
        </article>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Memos</h2>
        <p className="mt-1 text-sm text-[#6b7280]">대시보드 포스트잇 전체. 최신순.</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
          {slice.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#6b7280]">메모 없음</p>
          ) : (
            slice.map((m) => (
              <article key={m.id} className="border-t border-[#f3f4f6] px-4 py-3 first:border-t-0">
                <div className="text-xs text-[#9ca3af]">
                  {new Date(m.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
              </article>
            ))
          )}
        </div>
        {pages > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            <button disabled={page <= 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">이전</button>
            <span>{page + 1} / {pages}</span>
            <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">다음</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
