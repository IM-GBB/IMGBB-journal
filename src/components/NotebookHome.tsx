"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats } from "@/lib/types";
import { money, weekday } from "@/lib/format";

type NoteRow = { date: string; note: string };

export default function NotebookHome() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then(async (ov) => {
        const list: DayStats[] = ov.days || [];
        setDays(list);
        const rows: NoteRow[] = [];
        for (const d of list.slice().reverse()) {
          const j = await fetch(`/api/day-note?date=${d.dateKst}`).then((r) => r.json());
          rows.push({ date: d.dateKst, note: j.note || "" });
        }
        setNotes(rows);
      });
  }, []);

  const byDate = useMemo(() => new Map(days.map((d) => [d.dateKst, d])), [days]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-[#6b7280]">Notebook</p>
      <h1 className="mt-1 text-3xl font-semibold">Daily notes</h1>
      <div className="mt-6 space-y-3">
        {notes.map((n) => {
          const st = byDate.get(n.date);
          return (
            <article key={n.date} className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">
                  {weekday(n.date)}, {n.date}
                </h2>
                <span className={st && st.netPnl >= 0 ? "text-[#16a34a]" : "text-[#ef4444]"}>
                  {st ? money(st.netPnl) : ""}
                </span>
              </div>
              {st ? (
                <p className="mt-1 text-xs text-[#6b7280]">
                  {st.trades} trades · wr {(st.winRate * 100).toFixed(0)}% · fees {money(st.fee)}
                </p>
              ) : null}
              <p className="mt-3 whitespace-pre-wrap text-sm">{n.note || "No note yet."}</p>
              <a href={`/?focus=${n.date}`} className="mt-2 inline-block text-xs text-[#6d5cff]">
                Open in Day View
              </a>
            </article>
          );
        })}
      </div>
    </main>
  );
}