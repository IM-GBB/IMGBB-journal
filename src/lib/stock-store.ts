import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type StockEntry = {
  id: string;
  createdAt: string;
  ticker: string;
  name: string;
  tradeDate: string;
  tradeDateEnd: string;
  category: string;
  principleRate: string;
  weight: string;
  returnPct: number | null;
  psychology: string;
  diagnosis: string;
  memo: string;
  chartImages: string[];
};

export type StockListQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
};

function rowToEntry(r: any): StockEntry {
  let images: string[] = [];
  try {
    images = r.chart_images ? JSON.parse(r.chart_images) : [];
  } catch {
    images = [];
  }
  return {
    id: r.id,
    createdAt: r.created_at,
    ticker: r.ticker || "",
    name: r.name || "",
    tradeDate: r.trade_date || "",
    tradeDateEnd: r.trade_date_end || "",
    category: r.category || "",
    principleRate: r.principle_rate || "",
    weight: r.weight || "",
    returnPct: r.return_pct == null ? null : Number(r.return_pct),
    psychology: r.psychology || "",
    diagnosis: r.diagnosis || "",
    memo: r.memo || "",
    chartImages: images,
  };
}

export async function listStockEntries(query: StockListQuery) {
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 15));
  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * pageSize;
  const q = (query.q || "").trim();

  const rows = q
    ? await sql`
        select * from stock_entries
        where
          coalesce(name,'') ilike ${"%" + q + "%"}
          or coalesce(ticker,'') ilike ${"%" + q + "%"}
          or coalesce(trade_date,'') ilike ${"%" + q + "%"}
          or coalesce(trade_date_end,'') ilike ${"%" + q + "%"}
          or coalesce(category,'') ilike ${"%" + q + "%"}
          or coalesce(psychology,'') ilike ${"%" + q + "%"}
          or coalesce(diagnosis,'') ilike ${"%" + q + "%"}
          or coalesce(memo,'') ilike ${"%" + q + "%"}
        order by trade_date desc, created_at desc
        limit ${pageSize} offset ${offset}
      `
    : await sql`
        select * from stock_entries
        order by trade_date desc, created_at desc
        limit ${pageSize} offset ${offset}
      `;

  const countRows = q
    ? await sql`
        select count(*)::int as n from stock_entries
        where
          coalesce(name,'') ilike ${"%" + q + "%"}
          or coalesce(ticker,'') ilike ${"%" + q + "%"}
          or coalesce(trade_date,'') ilike ${"%" + q + "%"}
          or coalesce(trade_date_end,'') ilike ${"%" + q + "%"}
          or coalesce(category,'') ilike ${"%" + q + "%"}
          or coalesce(psychology,'') ilike ${"%" + q + "%"}
          or coalesce(diagnosis,'') ilike ${"%" + q + "%"}
          or coalesce(memo,'') ilike ${"%" + q + "%"}
      `
    : await sql`select count(*)::int as n from stock_entries`;

  const total = Number(countRows[0]?.n || 0);
  return {
    items: rows.map(rowToEntry),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getStockEntry(id: string): Promise<StockEntry | null> {
  const rows = await sql`select * from stock_entries where id = ${id}`;
  return rows[0] ? rowToEntry(rows[0]) : null;
}

export async function createStockEntry(input: Partial<StockEntry>): Promise<StockEntry> {
  const id = `stock:${Date.now()}`;
  const images = JSON.stringify(input.chartImages || []);
  await sql`
    insert into stock_entries (
      id, ticker, name, trade_date, trade_date_end, category,
      principle_rate, weight, return_pct, psychology, diagnosis, memo, chart_images
    )
    values (
      ${id},
      ${input.ticker || ""},
      ${input.name || "무제"},
      ${input.tradeDate || ""},
      ${input.tradeDateEnd || ""},
      ${input.category || ""},
      ${input.principleRate || ""},
      ${input.weight || ""},
      ${input.returnPct ?? null},
      ${input.psychology || ""},
      ${input.diagnosis || ""},
      ${input.memo || ""},
      ${images}
    )
  `;
  const created = await getStockEntry(id);
  return created!;
}

export async function updateStockEntry(id: string, input: Partial<StockEntry>): Promise<StockEntry | null> {
  const prev = await getStockEntry(id);
  if (!prev) return null;
  const next: StockEntry = {
    ...prev,
    ...input,
    chartImages: input.chartImages ?? prev.chartImages,
  };
  const images = JSON.stringify(next.chartImages || []);
  await sql`
    update stock_entries set
      ticker = ${next.ticker},
      name = ${next.name},
      trade_date = ${next.tradeDate},
      trade_date_end = ${next.tradeDateEnd},
      category = ${next.category},
      principle_rate = ${next.principleRate},
      weight = ${next.weight},
      return_pct = ${next.returnPct},
      psychology = ${next.psychology},
      diagnosis = ${next.diagnosis},
      memo = ${next.memo},
      chart_images = ${images}
    where id = ${id}
  `;
  return getStockEntry(id);
}

export async function deleteStockEntry(id: string) {
  await sql`delete from stock_entries where id = ${id}`;
}