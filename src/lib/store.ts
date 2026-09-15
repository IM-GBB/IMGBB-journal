import { neon } from "@neondatabase/serverless";
import type { DayStats, Trade } from "./types";

const sql = neon(process.env.DATABASE_URL!);

export async function listTrades(dateKst?: string): Promise<Trade[]> {
  const rows = dateKst
    ? await sql`select * from trades where date_kst = ${dateKst} order by closed_at asc`
    : await sql`select * from trades order by closed_at asc`;
  return rows.map(rowToTrade);
}

export async function upsertTrades(incoming: Trade[]): Promise<Trade[]> {
  for (const t of incoming) {
    const prev = (await sql`select memo from trades where id = ${t.id}`)[0];
    await sql`
      insert into trades (
        id, date_kst, inst_id, side, leverage,
        realized_pnl, fee, funding_fee, net_pnl, win, memo, closed_at
      )
      values (
        ${t.id}, ${t.dateKst}, ${t.instId}, ${t.side}, ${t.leverage},
        ${t.realizedPnl}, ${t.fee}, ${t.fundingFee}, ${t.netPnl}, ${t.win},
        ${prev?.memo || t.memo || ""}, ${t.closedAt}
      )
      on conflict (id) do update set
        date_kst = excluded.date_kst,
        inst_id = excluded.inst_id,
        side = excluded.side,
        leverage = excluded.leverage,
        realized_pnl = excluded.realized_pnl,
        fee = excluded.fee,
        funding_fee = excluded.funding_fee,
        net_pnl = excluded.net_pnl,
        win = excluded.win,
        closed_at = excluded.closed_at
    `;
  }
  return incoming;
}

export async function updateMemo(id: string, memo: string): Promise<Trade | null> {
  const rows = await sql`
    update trades set memo = ${memo} where id = ${id} returning *
  `;
  return rows[0] ? rowToTrade(rows[0]) : null;
}

export async function addManual(trade: Trade): Promise<Trade> {
  await sql`
    insert into trades (
      id, date_kst, inst_id, side, leverage,
      realized_pnl, fee, funding_fee, net_pnl, win, memo, closed_at
    )
    values (
      ${trade.id}, ${trade.dateKst}, ${trade.instId}, ${trade.side}, ${trade.leverage},
      ${trade.realizedPnl}, ${trade.fee}, ${trade.fundingFee}, ${trade.netPnl}, ${trade.win},
      ${trade.memo ?? ""}, ${trade.closedAt}
    )
    on conflict (id) do update set
      date_kst = excluded.date_kst,
      inst_id = excluded.inst_id,
      side = excluded.side,
      leverage = excluded.leverage,
      realized_pnl = excluded.realized_pnl,
      fee = excluded.fee,
      funding_fee = excluded.funding_fee,
      net_pnl = excluded.net_pnl,
      win = excluded.win,
      memo = excluded.memo,
      closed_at = excluded.closed_at
  `;
  return trade;
}

export async function dayStats(dateKst: string): Promise<DayStats> {
  const trades = await listTrades(dateKst);
  const wins = trades.filter((t) => t.win).length;
  const levers = trades.map((t) => t.leverage).filter((n): n is number => n != null && n > 0);
  const net = trades.reduce((s, t) => s + t.netPnl, 0);
  return {
    dateKst,
    trades: trades.length,
    wins,
    losses: trades.length - wins,
    winRate: trades.length ? wins / trades.length : 0,
    realizedPnl: trades.reduce((s, t) => s + t.realizedPnl, 0),
    fee: trades.reduce((s, t) => s + t.fee, 0),
    fundingFee: trades.reduce((s, t) => s + t.fundingFee, 0),
    netPnl: net,
    avgLeverage: levers.length ? levers.reduce((a, b) => a + b, 0) / levers.length : null,
  };
}

export async function allDayStats(): Promise<DayStats[]> {
  const rows = await sql`select distinct date_kst from trades order by date_kst asc`;
  return Promise.all(rows.map((r) => dayStats(String(r.date_kst))));
}

function rowToTrade(r: any): Trade {
  return {
    id: r.id,
    dateKst: r.date_kst,
    instId: r.inst_id,
    side: r.side,
    leverage: r.leverage,
    realizedPnl: Number(r.realized_pnl ?? 0),
    fee: Number(r.fee ?? 0),
    fundingFee: Number(r.funding_fee ?? 0),
    netPnl: Number(r.net_pnl ?? 0),
    win: Boolean(r.win),
    memo: r.memo,
    closedAt: r.closed_at,
  } as Trade;
}