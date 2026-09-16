import { createHmac } from "crypto";
import { kstDateKey, kstRangeUtcMs } from "./kst";
import type { Trade } from "./types";

const BASE = "https://www.okx.com";

function creds() {
  const apiKey = process.env.OKX_API_KEY ?? "";
  const secret = process.env.OKX_API_SECRET ?? "";
  const passphrase = process.env.OKX_API_PASSPHRASE ?? "";
  return { apiKey, secret, passphrase, ready: Boolean(apiKey && secret && passphrase) };
}

function sign(timestamp: string, method: string, path: string, secret: string) {
  return createHmac("sha256", secret).update(timestamp + method + path).digest("base64");
}

async function okxGet<T>(pathWithQuery: string): Promise<T> {
  const { apiKey, secret, passphrase, ready } = creds();
  if (!ready) throw new Error("OKX 키가 없습니다.");
  const timestamp = new Date().toISOString();
  const headers = {
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": sign(timestamp, "GET", pathWithQuery, secret),
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
  };
  const res = await fetch(BASE + pathWithQuery, { headers, cache: "no-store" });
  const json = (await res.json()) as { code: string; msg: string; data: T };
  if (json.code !== "0") throw new Error(json.msg || `OKX error ${json.code}`);
  return json.data;
}

type PosHist = {
  instId: string;
  instType: string;
  posId: string;
  type?: string;
  direction?: string;
  posSide?: string;
  lever?: string;
  mgnMode?: string;
  openAvgPx?: string;
  closeAvgPx?: string;
  closeTotalPos?: string;
  realizedPnl?: string;
  fee?: string;
  fundingFee?: string;
  pnl?: string;
  uTime?: string;
  cTime?: string;
};

function num(v?: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sideOf(p: PosHist): "long" | "short" {
  const d = (p.direction || p.posSide || "").toLowerCase();
  return d === "short" ? "short" : "long";
}

function dedupeCloses(rows: PosHist[]): PosHist[] {
  const byKey = new Map<string, PosHist>();
  for (const row of rows) {
    if (row.type === "1") continue;
    const ts = row.uTime || row.cTime || "";
    const key = `${row.posId || row.instId}:${ts}`;
    const prev = byKey.get(key);
    if (!prev || Number(row.uTime || 0) >= Number(prev.uTime || 0)) byKey.set(key, row);
  }
  if (byKey.size === 0) {
    for (const row of rows) {
      const ts = row.uTime || row.cTime || "";
      byKey.set(`${row.posId || row.instId}:${ts}:${row.realizedPnl}:${row.fee}`, row);
    }
  }
  return [...byKey.values()];
}

export async function syncDay(dateKst: string): Promise<Trade[]> {
  const { begin, end } = kstRangeUtcMs(dateKst);
  const now = Date.now();
  if (begin < now - 90 * 86400000) {
    throw new Error("이 날짜는 OKX API 3개월 창 밖입니다.");
  }

  const ALLOWED = new Set(["SWAP", "FUTURES", "MARGIN", "OPTION"]);
  const instTypes = (process.env.OKX_INST_TYPES || "SWAP")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => ALLOWED.has(s));
  if (!instTypes.length) instTypes.push("SWAP");

  const collected: PosHist[] = [];
  for (const instType of instTypes) {
    let after = String(end);
    for (let page = 0; page < 20; page++) {
      const q = `/api/v5/account/positions-history?instType=${instType}&after=${after}&limit=100`;
      const rows = await okxGet<PosHist[]>(q);
      if (!rows.length) break;
      for (const row of rows) {
        const ts = Number(row.uTime || row.cTime || 0);
        if (ts >= begin && ts < end) collected.push(row);
      }
      const oldest = Number(rows[rows.length - 1]?.uTime || 0);
      if (oldest < begin || rows.length < 100) break;
      after = String(oldest);
    }
  }

  return dedupeCloses(collected)
    .map((p) => {
      const realized = num(p.realizedPnl);
      const fee = num(p.fee);
      const funding = num(p.fundingFee);
      const net = realized !== 0 ? realized : num(p.pnl) + fee + funding;
      const ts = Number(p.uTime || p.cTime || begin);
      return {
        id: `okx:${p.posId || p.instId}:${p.uTime || p.cTime}`,
        dateKst: kstDateKey(new Date(ts)),
        closedAt: new Date(ts).toISOString(),
        instId: p.instId,
        instType: p.instType,
        side: sideOf(p),
        leverage: p.lever ? num(p.lever) : null,
        mgnMode: p.mgnMode || "",
        openAvgPx: p.openAvgPx ? num(p.openAvgPx) : null,
        closeAvgPx: p.closeAvgPx ? num(p.closeAvgPx) : null,
        size: p.closeTotalPos ? num(p.closeTotalPos) : null,
        realizedPnl: realized,
        fee,
        fundingFee: funding,
        netPnl: net,
        win: net > 0,
        memo: "",
        source: "okx" as const,
        posId: p.posId,
      };
    })
    .filter((t) => t.dateKst === dateKst);
}

export async function getEquityUsd(): Promise<number | null> {
  const data = await okxGet<{ totalEq?: string }[]>("/api/v5/account/balance");
  const n = Number(data?.[0]?.totalEq);
  return Number.isFinite(n) ? n : null;
}
export async function fetchDayRebate(dateKst: string, feeSum: number): Promise<number> {
  const { begin, end } = kstRangeUtcMs(dateKst);
  let after = "";
  let sum = 0;
  try {
    for (let page = 0; page < 10; page++) {
      const q = `/api/v5/asset/bills?limit=100${after ? `&after=${after}` : ""}`;
      const rows = await okxGet<{ type?: string; ts?: string; balChg?: string; billId?: string; notes?: string }[]>(q);
      if (!rows.length) break;
      for (const row of rows) {
        const ts = Number(row.ts || 0);
        if (ts < begin || ts >= end) continue;
        const typ = String(row.type || "");
        const note = String(row.notes || "").toLowerCase();
        const amt = Number(row.balChg || 0);
        if (typ === "300" || typ === "173" || typ === "68" || note.includes("rebate")) {
          if (amt > 0) sum += amt;
        }
      }
      after = String(rows[rows.length - 1]?.billId || "");
      const oldest = Number(rows[rows.length - 1]?.ts || 0);
      if (!after || oldest < begin) break;
    }
  } catch {
    sum = 0;
  }
  if (sum > 0) return sum;
  return Math.abs(feeSum) * 0.2;
}
export async function fetchDayRebate(dateKst: string, feeSum: number): Promise<number> {
  const { begin, end } = kstRangeUtcMs(dateKst);
  let after = "";
  let sum = 0;
  try {
    for (let page = 0; page < 15; page++) {
      const q = `/api/v5/asset/bills?limit=100${after ? `&after=${after}` : ""}`;
      const rows = await okxGet<{ type?: string; ts?: string; balChg?: string; billId?: string; notes?: string }[]>(q);
      if (!rows.length) break;
      for (const row of rows) {
        const ts = Number(row.ts || 0);
        if (ts < begin || ts >= end) continue;
        const note = String(row.notes || "").toLowerCase();
        const amt = Number(row.balChg || 0);
        if (amt > 0 && note.includes("rebate")) sum += amt;
      }
      after = String(rows[rows.length - 1]?.billId || "");
      const oldest = Number(rows[rows.length - 1]?.ts || 0);
      if (!after || oldest < begin) break;
    }
  } catch {
    sum = 0;
  }
  return sum;
}
export function okxConfigured(): boolean {
  return creds().ready;
}