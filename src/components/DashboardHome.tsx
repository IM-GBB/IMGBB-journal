"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStats, Trade } from "@/lib/types";
import HoverAreaChart from "@/components/HoverAreaChart";
import { money, tickerOf } from "@/lib/format";
import { RichText, asHtml } from "@/components/RichText";

type Range = "D" | "W" | "M" | "Y";
type Memo = { id: string; body: string; createdAt: string; pinned?: boolean };
const COLORS = ["#fef3c7", "#fce7f3", "#dbeafe", "#dcfce7"];

export default function DashboardHome() {
  const [days, setDays] = useState<DayStats[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rebates, setRebates] = useState<{ dateKst: string; amount: number }[]>([]);
  const [range, setRange] = useState<Range>("D");
  const [motto, setMotto] = useState("");
  const [mottoSub, setMottoSub] = useState("");
  const [mottoEdit, setMottoEdit] = useState(false);
  const [mottoDraft, setMottoDraft] = useState("");
  const [mottoSubDraft, setMottoSubDraft] = useState("");
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoOpen, setMemoOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/overview").then((r) => r.json()),
      fetch("/api/trades").then((r) => r.json()),
      fetch("/api/rebates").then((r) => r.json()).catch(() => ({ rebates: [] })),
      fetch("/api/motto").then((r) => r.json()).catch(() => ({ text: "", sub: "" })),
      fetch("/api/memos").then((r) => r.json()).catch(() => ({ memos: [] })),
    ]).then(([ov, tr, rb, mt, mm]) => {
      setDays(ov.days || []);
      setTrades(tr.trades || []);
      setRebates(rb.rebates || []);
      setMotto(mt.text || "");
      setMottoSub(mt.sub || "");
      setMemos(mm.memos || []);
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
    if (range === "D") return daily;
    const m = new Map<string, { label: string; value: number }>();
    for (const p of daily.slice(1)) {
      let key = p.label;
      if (range === "W") {
        const d = new Date(`${p.label}T12:00:00+09:00`);
        d.setDate(d.getDate() - d.getDay());
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      } else if (range === "M") key = p.label.slice(0, 7);
      else key = p.label.slice(0, 4);
      m.set(key, { label: key, value: p.value });
    }
    return [{ label: "start", value: 0 }, ...m.values()];
  }, [days, rebateMap, range]);

  const last = series[series.length - 1]?.value ?? 0;
  const month = days.length ? days[days.length - 1].dateKst.slice(0, 7) : "";
  const monthDays = days.filter((d) => d.dateKst.startsWith(month));
  const monthNet = monthDays.reduce((s, d) => s + d.netPnl, 0);
  const monthRebate = monthDays.reduce((s, d) => s + (rebateMap.get(d.dateKst) || 0), 0);
  const monthTrades = monthDays.reduce((s, d) => s + d.trades, 0);
  const monthWins = monthDays.reduce((s, d) => s + d.wins, 0);
  const allTrades = days.reduce((s, d) => s + d.trades, 0);
  const allRebate = rebates.reduce((s, r) => s + r.amount, 0);
  const winDays = days.filter((d) => d.netPnl > 0).length;
  const symbols = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      const k = tickerOf(t.instId);
      map.set(k, (map.get(k) || 0) + t.netPnl);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [trades]);

  const pins = useMemo(() => {
    const pinned = memos.filter((m) => m.pinned);
    const rest = memos.filter((m) => !m.pinned);
    return [...pinned, ...rest].slice(0, Math.max(4, pinned.length));
  }, [memos]);

  async function saveMotto() {
    const j = await fetch("/api/motto", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: mottoDraft, sub: mottoSubDraft }),
    }).then((r) => r.json());
    setMotto(j.text ?? mottoDraft);
    setMottoSub(j.sub ?? mottoSubDraft);
    setMottoEdit(false);
  }
  async function addMemo() {
    if (!draft.replace(/<[^>]+>/g, "").trim()) return;
    const j = await fetch("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    }).then((r) => r.json());
    if (j.memo) setMemos((prev) => [j.memo, ...prev]);
    setDraft("");
    setAdding(false);
  }
  async function saveMemo() {
    if (!editId) return;
    const j = await fetch("/api/memos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, body: editBody }),
    }).then((r) => r.json());
    if (j.memo) setMemos((prev) => prev.map((m) => (m.id === editId ? j.memo : m)));
    setEditId(null);
  }
  async function togglePin(m: Memo) {
    const j = await fetch("/api/memos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, pinned: !m.pinned }),
    }).then((r) => r.json());
    if (j.memo) setMemos((prev) => prev.map((x) => (x.id === m.id ? j.memo : x)));
  }
  async function removeMemo(id: string) {
    await fetch(`/api/memos?id=${id}`, { method: "DELETE" });
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-[#6b7280]">IMGBB Journal</p>
      <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>
      <section className="mt-6">
        {mottoEdit ? (
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <input className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-lg font-semibold" value={mottoDraft} onChange={(e) => setMottoDraft(e.target.value)} placeholder="큰 좌우명" />
            <input className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" value={mottoSubDraft} onChange={(e) => setMottoSubDraft(e.target.value)} placeholder="작은 좌우명" />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setMottoEdit(false)} className="px-3 py-1 text-sm text-[#6b7280]">Cancel</button>
              <button onClick={saveMotto} className="rounded-lg bg-[#6d5cff] px-3 py-1 text-sm text-white">Save</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => { setMottoDraft(motto); setMottoSubDraft(mottoSub); setMottoEdit(true); }} className="min-h-[56px] w-full text-left">
            <p className={`text-2xl font-bold leading-snug md:text-3xl ${motto ? "text-[#111827]" : "text-[#d1d5db]"}`}>{motto || "…"}</p>
            {mottoSub ? <p className="mt-2 text-sm text-[#6b7280]">{mottoSub}</p> : null}
          </button>
        )}
      </section>
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setMemoOpen((v) => !v)} className="text-lg font-semibold">Memo {memoOpen ? "▾" : "▸"}</button>
          <button onClick={() => { setAdding(true); setMemoOpen(true); }} className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-xs text-[#6b7280]">Add memo</button>
        </div>
        {memoOpen ? (
          <>
            {adding ? (
              <div className="mb-3 rounded-xl border border-[#e5e7eb] bg-white p-3">
                <RichText value={draft} onChange={setDraft} />
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => setAdding(false)} className="text-sm text-[#6b7280]">Cancel</button>
                  <button onClick={addMemo} className="rounded-lg bg-[#6d5cff] px-3 py-1 text-sm text-white">Save</button>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {pins.map((m, i) => (
                <article key={m.id} className="flex aspect-square flex-col rounded-md p-3 shadow-sm" style={{ background: COLORS[i % COLORS.length] }}>
                  {editId === m.id ? (
                    <>
                      <div className="min-h-0 flex-1 overflow-auto"><RichText value={editBody} onChange={setEditBody} /></div>
                      <div className="mt-2 flex gap-2 text-xs">
                        <button onClick={saveMemo}>저장</button>
                        <button onClick={() => setEditId(null)}>취소</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="min-h-0 flex-1 overflow-auto text-sm text-[#1f2937]" dangerouslySetInnerHTML={{ __html: asHtml(m.body) }} />
                      <div className="mt-2 flex gap-2 text-[11px] text-[#6b7280]">
                        <button onClick={() => togglePin(m)}>{m.pinned ? "고정해제" : "고정"}</button>
                        <button onClick={() => { setEditId(m.id); setEditBody(m.body); }}>수정</button>
                        <button onClick={() => removeMemo(m.id)}>삭제</button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
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
            {(["D", "W", "M", "Y"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`rounded px-3 py-1 text-sm ${range === r ? "bg-[#efeaff] text-[#5b45e0]" : "text-[#6b7280]"}`}>{r}</button>
            ))}
          </div>
        </div>
        <HoverAreaChart points={series} baseline={0} height={240} />
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
            <a key={d.dateKst} href="/" className="flex justify-between border-t border-[#f3f4f6] py-2 text-sm first:border-t-0">
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
