import { NextRequest, NextResponse } from "next/server";
import { isValidDateKey } from "@/lib/kst";
import { okxConfigured, syncDay } from "@/lib/okx";
import { dayStats, upsertTrades } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { date?: string };
  const date = body.date;
  if (!date || !isValidDateKey(date)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD 필요" }, { status: 400 });
  }
  if (!okxConfigured()) {
    return NextResponse.json({ error: "OKX 키 미설정. .env.local을 채우세요." }, { status: 400 });
  }
  try {
    const incoming = await syncDay(date);
    upsertTrades(incoming);
    return NextResponse.json({
      synced: incoming.length,
      trades: incoming,
      stats: dayStats(date),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "동기화 실패";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ configured: okxConfigured() });
}
