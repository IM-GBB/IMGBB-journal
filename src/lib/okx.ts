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
  if (!ready) throw new Error("OKX 키가 없습니다. .env.local에 Read-only 키를 넣으세요.");
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

export async function syncDay(dateKst: string): Promise<Trade[]> {
  const { begin, end } = kstRangeUtcMs(dateKst);
  const now = Date.now();
  const threeMonths = 90 * 86400000;
  if (begin < now - threeMonths) {
    throw new Error("이 날짜는 OKX API 3개월 창 밖입니다. CSV로 넣으세요.");
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

  return collected.map((p) => {
    const realized = num(p.realizedPnl);
    const fee = num(p.fee);
    const funding = num(p.fundingFee);
    const net = realized !== 0 ? realized : num(p.pnl) + fee + funding;
    const closedAt = new Date(Number(p.uTime || p.cTime || begin)).toISOString();
    const id = `okx:${p.posId}:${p.uTime || p.cTime}`;
    return {
      id,
      dateKst: kstDateKey(new Date(Number(p.uTime || p.cTime || begin))),
      closedAt,
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
  }).filter((t) => t.dateKst === dateKst);
}

export function okxConfigured(): boolean {
  return creds().ready;
}
