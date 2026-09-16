import { NextResponse } from "next/server";
import { listRebates } from "@/lib/rebate";

export async function GET() {
  return NextResponse.json({ rebates: await listRebates() });
}