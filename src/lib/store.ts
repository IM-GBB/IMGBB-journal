import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { DayStats, Trade } from "./types";

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "journal.json");

type DB = { trades: Trade[] };

function load(): DB {
  if (!existsSync(FILE)) return { trades: [] };
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as DB;
  } catch {
    return { trades: [] };
  }
}

function save(db: DB) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2), "utf8");
}

export function listTrades(dateKst?: string): Trade[] {
  const trades = load().trades;
  const filtered = dateKst ? trades.filter((t) => t.dateKst === dateKst) : trades;
  return filtered.sort((a, b) => a.closedAt.localeCompare(b.closedAt));
}

export function upsertTrades(incoming: Trade[]): Trade[] {
  const db = load();
  const byId = new Map(db.trades.map((t) => [t.id, t]));
  for (const t of incoming) {
    const prev = byId.get(t.id);
    byId.set(t.id, prev ? { ...t, memo: prev.memo || t.memo } : t);
  }
  db.trades = [...byId.values()];
  save(db);
  return incoming;
}

export function updateMemo(id: string, memo: string): Trade | null {
  const db = load();
  const i = db.trades.findIndex((t) => t.id === id);
  if (i < 0) return null;
  db.trades[i] = { ...db.trades[i], memo };
  save(db);
  return db.trades[i];
}

export function addManual(trade: Trade): Trade {
  const db = load();
  db.trades.push(trade);
  save(db);
  return trade;
}

export function dayStats(dateKst: string): DayStats {
  const trades = listTrades(dateKst);
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

export function allDayStats(): DayStats[] {
  const dates = [...new Set(load().trades.map((t) => t.dateKst))].sort();
  return dates.map(dayStats);
}
