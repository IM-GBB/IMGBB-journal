import { NextRequest, NextResponse } from "next/server";
import { getMotto, setMotto } from "@/lib/memos";

export async function GET() {
  try {
    return NextResponse.json({ text: await getMotto() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ text: "", error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { text?: string };
  try {
    const text = await setMotto(String(body.text ?? ""));
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
