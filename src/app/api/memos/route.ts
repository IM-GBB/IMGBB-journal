import { NextRequest, NextResponse } from "next/server";
import { addSticky, deleteSticky, listStickies, updateSticky } from "@/lib/memos";

export async function GET() {
  try {
    return NextResponse.json({ memos: await listStickies() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ memos: [], error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { body?: string };
  const text = String(body.body ?? "").replace(/<[^>]+>/g, "").trim();
  if (!text) return NextResponse.json({ error: "내용 필요" }, { status: 400 });
  try {
    const memo = await addSticky(String(body.body ?? ""));
    return NextResponse.json({ memo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id?: string; body?: string; pinned?: boolean };
  if (!body.id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  try {
    const memo = await updateSticky(body.id, { body: body.body, pinned: body.pinned });
    if (!memo) return NextResponse.json({ error: "없음" }, { status: 404 });
    return NextResponse.json({ memo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  try {
    await deleteSticky(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
