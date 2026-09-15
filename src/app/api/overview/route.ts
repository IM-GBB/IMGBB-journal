import { NextResponse } from "next/server";
import { allDayStats, listTrades } from "@/lib/store";

export async function GET() {
  const days = allDayStats();
  let cum = 0;
  const curve = days.map((d) => {
    cum += d.netPnl;
    return { dateKst: d.dateKst, netPnl: d.netPnl, cum };
  });
  return NextResponse.json({ days, curve, totalTrades: listTrades().length });
}
