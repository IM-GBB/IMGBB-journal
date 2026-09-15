import { NextRequest, NextResponse } from "next/server";
import { deleteStockEntry, getStockEntry, updateStockEntry } from "@/lib/stock-store";

export const maxDuration = 30;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getStockEntry(id);
  if (!item) return NextResponse.json({ error: "없음" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const item = await updateStockEntry(id, body);
  if (!item) return NextResponse.json({ error: "없음" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteStockEntry(id);
  return NextResponse.json({ ok: true });
}