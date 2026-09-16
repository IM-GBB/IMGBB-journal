import { NextResponse } from "next/server";
import { getEquityUsd, okxConfigured } from "@/lib/okx";

export async function GET() {
  if (!okxConfigured()) return NextResponse.json({ equityUsd: null });
  return NextResponse.json({ equityUsd: await getEquityUsd() });
}