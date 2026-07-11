// Exchange берётся из lib/exchanges/types.ts, чтобы при добавлении новой
// биржи не надо было править этот тип — он автоматически расширится через
// union в lib/exchanges/types.ts. "manual" — это не настоящая биржа, а ручные
// сделки пользователя.
import type { Exchange } from "@/lib/exchanges/types";

export type { Exchange };

export interface Trade {
  id: string;
  user_id: string;
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
  notes: string | null;
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

// Поля, которые пользователь заполняет вручную при добавлении сделки
export interface ManualTradeInput {
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
  notes: string | null;
}

// Данные, которые формируют клиенты бирж перед upsert-ом. Намеренно БЕЗ notes —
// если передавать notes: null явно, upsert будет затирать вручную написанные
// заметки при каждом ресинке. Отсутствие ключа в payload = колонка не трогается.
export type SyncedTrade = Omit<Trade, "id" | "notes" | "user_id">;
