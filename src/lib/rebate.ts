import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function upsertRebate(dateKst: string, amount: number) {
  await sql`
    insert into day_rebates (date_kst, amount)
    values (${dateKst}, ${amount})
    on conflict (date_kst) do update set amount = excluded.amount
  `;
}

export async function listRebates(): Promise<{ dateKst: string; amount: number }[]> {
  const rows = await sql`select date_kst, amount from day_rebates`;
  return rows.map((r) => ({ dateKst: String(r.date_kst), amount: Number(r.amount || 0) }));
}

export async function rebateOn(dateKst: string): Promise<number> {
  const rows = await sql`select amount from day_rebates where date_kst = ${dateKst}`;
  return Number(rows[0]?.amount || 0);
}