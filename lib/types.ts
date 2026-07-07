export type Exchange = "bybit" | "bitunix";

export interface Trade {
  id: string;
  exchange: Exchange;
  external_id: string;
  symbol: string;
  side: "long" | "short";
  qty: number | null;
  entry_price: number | null;
  close_price: number | null;
  realized_pnl: number;
  fee: number;
  funding: number;
  opened_at: string | null;
  closed_at: string;
  raw: unknown;
}

export interface MonthlySummary {
  month: string; // "2026-07"
  totalPnl: number;
  totalFee: number;
  totalFunding: number;
  netPnl: number;
  tradeCount: number;
  winRate: number;
}
