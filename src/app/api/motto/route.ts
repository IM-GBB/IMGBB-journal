import { NextRequest, NextResponse } from "next/server";
import { getMotto, setMotto } from "@/lib/memos";

export async function GET() {
  try {
    const m = await getMotto();
    return NextResponse.json({ text: m.text, sub: m.sub });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ text: "", sub: "", error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { text?: string; sub?: string };
  try {
    const m = await setMotto(String(body.text ?? ""), String(body.sub ?? ""));
    return NextResponse.json(m);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
