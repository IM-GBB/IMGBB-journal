import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type StickyMemo = { id: string; body: string; createdAt: string; pinned: boolean };
export type Motto = { text: string; sub: string };

export function sanitizeHtml(input: string) {
  return String(input || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
}

export async function ensureMemoTables() {
  await sql`create table if not exists mottos (
    id integer primary key,
    text text not null default ''
  )`;
  await sql`create table if not exists stickies (
    id text primary key,
    body text not null default '',
    created_at timestamptz not null default now()
  )`;
  await sql`alter table mottos add column if not exists sub text not null default ''`;
  await sql`alter table stickies add column if not exists pinned boolean not null default false`;
}

export async function getMotto(): Promise<Motto> {
  await ensureMemoTables();
  const rows = await sql`select text, sub from mottos where id = 1`;
  return { text: String(rows[0]?.text || ""), sub: String(rows[0]?.sub || "") };
}

export async function setMotto(text: string, sub = ""): Promise<Motto> {
  await ensureMemoTables();
  await sql`
    insert into mottos (id, text, sub) values (1, ${text}, ${sub})
    on conflict (id) do update set text = excluded.text, sub = excluded.sub
  `;
  return { text, sub };
}

function mapSticky(r: Record<string, unknown>): StickyMemo {
  return {
    id: String(r.id),
    body: String(r.body || ""),
    createdAt: new Date(String(r.created_at)).toISOString(),
    pinned: Boolean(r.pinned),
  };
}

export async function listStickies(): Promise<StickyMemo[]> {
  await ensureMemoTables();
  const rows = await sql`select id, body, created_at, pinned from stickies order by pinned desc, created_at desc`;
  return rows.map((r) => mapSticky(r as Record<string, unknown>));
}

export async function addSticky(body: string): Promise<StickyMemo> {
  await ensureMemoTables();
  const id = `m_${Date.now()}`;
  const clean = sanitizeHtml(body);
  await sql`insert into stickies (id, body) values (${id}, ${clean})`;
  const rows = await sql`select id, body, created_at, pinned from stickies where id = ${id}`;
  return mapSticky(rows[0] as Record<string, unknown>);
}

export async function updateSticky(
  id: string,
  patch: { body?: string; pinned?: boolean }
): Promise<StickyMemo | null> {
  await ensureMemoTables();
  if (patch.body != null) {
    const clean = sanitizeHtml(patch.body);
    await sql`update stickies set body = ${clean} where id = ${id}`;
  }
  if (patch.pinned != null) {
    await sql`update stickies set pinned = ${patch.pinned} where id = ${id}`;
  }
  const rows = await sql`select id, body, created_at, pinned from stickies where id = ${id}`;
  if (!rows[0]) return null;
  return mapSticky(rows[0] as Record<string, unknown>);
}

export async function deleteSticky(id: string): Promise<void> {
  await ensureMemoTables();
  await sql`delete from stickies where id = ${id}`;
}
