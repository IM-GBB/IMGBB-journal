import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { isValidDateKey } from "@/lib/kst";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!isValidDateKey(date)) {
    return NextResponse.json({ error: "잘못된 날짜" }, { status: 400 });
  }
  const rows = await sql`select note from day_notes where date_kst = ${date}`;
  return NextResponse.json({ note: rows[0]?.note || "" });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { date?: string; note?: string };
  if (!body.date || !isValidDateKey(body.date)) {
    return NextResponse.json({ error: "date 필수" }, { status: 400 });
  }
  const note = body.note ?? "";
  await sql`
    insert into day_notes (date_kst, note) values (${body.date}, ${note})
    on conflict (date_kst) do update set note = excluded.note
  `;
  return NextResponse.json({ note });
}