import { NextRequest, NextResponse } from "next/server";
import { createStockEntry, listStockEntries } from "@/lib/stock-store";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const data = await listStockEntries({
    q: searchParams.get("q") || "",
    page: Number(searchParams.get("page") || 1),
    pageSize: Number(searchParams.get("pageSize") || 15),
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await createStockEntry(body);
  return NextResponse.json({ item });
}