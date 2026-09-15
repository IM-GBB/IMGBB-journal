"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StockEntry } from "@/lib/stock-store";

const CATEGORIES = ["종가배팅", "단기스윙", "장중단타", "주도주/섹터", "스윙", "기타"];
const PSY = ["무념무상", "확신", "충동", "불안", "탐욕", "공포"];
const DIAG = ["원칙매매", "뇌동매매", "관망", "보류"];

async function fileToDataUrl(file: File): Promise<string> {
  const raw = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / raw.width);
  const w = Math.round(raw.width * scale);
  const h = Math.round(raw.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(raw, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.72);
}

const empty: Partial<StockEntry> = {
  ticker: "",
  name: "",
  tradeDate: "",
  tradeDateEnd: "",
  category: "",
  principleRate: "",
  weight: "",
  returnPct: null,
  psychology: "",
  diagnosis: "",
  memo: "",
  chartImages: [],
};

export default function StockEditor({ id }: { id: string }) {
  const isNew = id === "new";
  const [form, setForm] = useState<Partial<StockEntry>>(empty);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/stock/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.item) setForm(j.item);
      });
  }, [id, isNew]);

  function set<K extends keyof StockEntry>(key: K, value: StockEntry[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const extras: string[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      extras.push(await fileToDataUrl(file));
    }
    setForm((f) => ({ ...f, chartImages: [...(f.chartImages || []), ...extras].slice(0, 6) }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.tradeDate) {
      setMsg("종목명과 매매일은 필수");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch(isNew ? "/api/stock" : `/api/stock/${id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "저장 실패");
      return;
    }
    window.location.href = `/stock/${json.item.id}`;
  }

  async function remove() {
    if (!confirm("이 글을 삭제할까요?")) return;
    await fetch(`/api/stock/${id}`, { method: "DELETE" });
    window.location.href = "/stock";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/stock" className="text-sm text-[#8b95a5]">← Stock Journal</Link>
      <h1 className="mt-2 text-3xl font-semibold">{isNew ? "새 매매일지" : form.name || "매매일지"}</h1>

      <form onSubmit={save} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#8b95a5]">
            종목명
            <input value={form.name || ""} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]" />
          </label>
          <label className="text-xs text-[#8b95a5]">
            티커/코드
            <input value={form.ticker || ""} onChange={(e) => set("ticker", e.target.value)} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]" />
          </label>
          <label className="text-xs text-[#8b95a5]">
            매매일
            <input type="date" value={form.tradeDate || ""} onChange={(e) => set("tradeDate", e.target.value)} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]" />
          </label>
          <label className="text-xs text-[#8b95a5]">
            종료일(선택)
            <input type="date" value={form.tradeDateEnd || ""} onChange={(e) => set("tradeDateEnd", e.target.value)} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]" />
          </label>
          <label className="text-xs text-[#8b95a5]">
            구분
            <select value={form.category || ""} onChange={(e) => set("category", e.target.value)} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]">
              <option value="">선택</option>
              {CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#8b95a5]">
            원칙달성률
            <input value={form.principleRate || ""} onChange={(e) => set("principleRate", e.target.value)} placeholder="예: 80%" className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]" />
          </label>
          <label className="text-xs text-[#8b95a5]">
            매매비중
            <input value={form.weight || ""} onChange={(e) => set("weight", e.target.value)} placeholder="예: 20%" className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]" />
          </label>
          <label className="text-xs text-[#8b95a5]">
            수익률(%)
            <input type="number" step="0.1" value={form.returnPct ?? ""} onChange={(e) => set("returnPct", e.target.value === "" ? null : Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]" />
          </label>
          <label className="text-xs text-[#8b95a5]">
            심리상태
            <select value={form.psychology || ""} onChange={(e) => set("psychology", e.target.value)} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]">
              <option value="">선택</option>
              {PSY.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#8b95a5]">
            최종진단
            <select value={form.diagnosis || ""} onChange={(e) => set("diagnosis", e.target.value)} className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm text-[#e8edf4]">
              <option value="">선택</option>
              {DIAG.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-xs text-[#8b95a5]">
          종목/매매 코멘트
          <textarea
            value={form.memo || ""}
            onChange={(e) => set("memo", e.target.value)}
            rows={12}
            className="mt-1 w-full rounded-lg border border-[#2a313c] bg-[#14181e] px-3 py-2 text-sm leading-6 text-[#e8edf4]"
            placeholder="당시 생각, 실수, 다음 원칙을 적습니다."
          />
        </label>

        <div>
          <div className="text-xs text-[#8b95a5]">차트 스크린샷</div>
          <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="mt-2 text-sm" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(form.chartImages || []).map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full rounded-lg border border-[#2a313c]" />
                <button
                  type="button"
                  onClick={() => set("chartImages", (form.chartImages || []).filter((_, idx) => idx !== i))}
                  className="absolute right-2 top-2 rounded bg-[#0b0d10cc] px-2 py-1 text-xs"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        {msg ? <p className="text-sm text-[#f0c674]">{msg}</p> : null}

        <div className="flex gap-2">
          <button disabled={busy} className="rounded-lg bg-[#e8edf4] px-4 py-2 text-sm text-[#0b0d10] disabled:opacity-50">
            {busy ? "저장 중…" : "저장"}
          </button>
          {!isNew ? (
            <button type="button" onClick={remove} className="rounded-lg border border-[#f07178] px-4 py-2 text-sm text-[#f07178]">
              삭제
            </button>
          ) : null}
        </div>
      </form>
    </main>
  );
}