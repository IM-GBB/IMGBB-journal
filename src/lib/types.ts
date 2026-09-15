export type Side = "long" | "short";
export type Source = "okx" | "manual";

export type Trade = {
  id: string;
  dateKst: string;
  closedAt: string;
  instId: string;
  instType: string;
  side: Side;
  leverage: number | null;
  mgnMode: string;
  openAvgPx: number | null;
  closeAvgPx: number | null;
  size: number | null;
  realizedPnl: number;
  fee: number;
  fundingFee: number;
  netPnl: number;
  win: boolean;
  memo: string;
  source: Source;
  posId?: string;
  billId?: string;
};

export type DayStats = {
  dateKst: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  realizedPnl: number;
  fee: number;
  fundingFee: number;
  netPnl: number;
  avgLeverage: number | null;
};
