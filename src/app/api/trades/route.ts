import { NextRequest, NextResponse } from "next/server";
import { addManual, dayStats, listTrades, updateMemo } from "@/lib/store";
import { isValidDateKey, kstDateKey } from "@/lib/kst";
import type { Trade } from "@/lib/types";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || kstDateKey();
  if (!isValidDateKey(date)) {
    return NextResponse.json({ error: "잘못된 날짜" }, { status: 400 });
  }
  return NextResponse.json({
    trades: await listTrades(date),
    stats: await dayStats(date),
  });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id?: string; memo?: string };
  if (!body.id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
  const trade = await updateMemo(body.id, body.memo ?? "");
  if (!trade) return NextResponse.json({ error: "없음" }, { status: 404 });
  return NextResponse.json({ trade });
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as Partial<Trade> & { dateKst?: string };
  if (!b.dateKst || !isValidDateKey(b.dateKst) || !b.instId) {
    return NextResponse.json({ error: "dateKst, instId 필수" }, { status: 400 });
  }
  const net = Number(b.netPnl ?? 0);
  const trade = {
    id: `manual:${Date.now()}`,
    dateKst: b.dateKst,
    closedAt: b.closedAt || new Date().toISOString(),
    instId: b.instId,
    instType: b.instType || "SWAP",
    side: b.side === "short" ? "short" : "long",
    leverage: b.leverage ?? null,
    mgnMode: b.mgnMode || "cross",
    openAvgPx: b.openAvgPx ?? null,
    closeAvgPx: b.closeAvgPx ?? null,
    size: b.size ?? null,
    realizedPnl: Number(b.realizedPnl ?? net),
    fee: Number(b.fee ?? 0),
    fundingFee: Number(b.fundingFee ?? 0),
    netPnl: net,
    win: net > 0,
    memo: b.memo || "",
    source: "manual",
  } as Trade;
  return NextResponse.json({ trade: await addManual(trade) });
}