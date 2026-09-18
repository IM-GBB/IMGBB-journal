import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type StickyMemo = { id: string; body: string; createdAt: string };

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
}

export async function getMotto(): Promise<string> {
  await ensureMemoTables();
  const rows = await sql`select text from mottos where id = 1`;
  return String(rows[0]?.text || "");
}

export async function setMotto(text: string): Promise<string> {
  await ensureMemoTables();
  await sql`
    insert into mottos (id, text) values (1, ${text})
    on conflict (id) do update set text = excluded.text
  `;
  return text;
}

export async function listStickies(): Promise<StickyMemo[]> {
  await ensureMemoTables();
  const rows = await sql`select id, body, created_at from stickies order by created_at desc`;
  return rows.map((r) => ({
    id: String(r.id),
    body: String(r.body || ""),
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function addSticky(body: string): Promise<StickyMemo> {
  await ensureMemoTables();
  const id = `m_${Date.now()}`;
  await sql`insert into stickies (id, body) values (${id}, ${body})`;
  const rows = await sql`select id, body, created_at from stickies where id = ${id}`;
  return {
    id: String(rows[0].id),
    body: String(rows[0].body || ""),
    createdAt: new Date(String(rows[0].created_at)).toISOString(),
  };
}

export async function updateSticky(id: string, body: string): Promise<StickyMemo | null> {
  await ensureMemoTables();
  await sql`update stickies set body = ${body} where id = ${id}`;
  const rows = await sql`select id, body, created_at from stickies where id = ${id}`;
  if (!rows[0]) return null;
  return {
    id: String(rows[0].id),
    body: String(rows[0].body || ""),
    createdAt: new Date(String(rows[0].created_at)).toISOString(),
  };
}

export async function deleteSticky(id: string): Promise<void> {
  await ensureMemoTables();
  await sql`delete from stickies where id = ${id}`;
}
