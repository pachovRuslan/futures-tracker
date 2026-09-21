import { z } from "zod";
import { EXCHANGES } from "@/lib/exchanges";

/**
 * Zod-схемы валидации для всех API-роутов.
 *
 * Принцип: каждый POST/PUT/PATCH принимает JSON-тело — валидируем через
 * safeParse. Если невалидно — 400 с конкретными ошибками полей.
 * Если валидно — тип выведен автоматически, никакого `as SomeType`.
 *
 * Пример использования в роуте:
 *   const parsed = ConnectionInput.safeParse(await req.json());
 *   if (!parsed.success) {
 *     return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
 *   }
 *   const { exchange, apiKey, apiSecret, passphrase } = parsed.data;
 */

// ============================================================
// Connections
// ============================================================

export const ConnectionInput = z.object({
  exchange: z.enum(EXCHANGES as [string, ...string[]]),
  apiKey: z.string().min(8).max(128),
  apiSecret: z.string().min(8).max(128),
  passphrase: z.string().max(128).optional(),
});

// ============================================================
// Trades (manual)
// ============================================================

export const ManualTradeInput = z.object({
  symbol: z.string().min(1).max(32),
  side: z.enum(["long", "short"]),
  qty: z.number().nullable(),
  entry_price: z.number().nullable(),
  close_price: z.number().nullable(),
  realized_pnl: z.number(),
  fee: z.number().default(0),
  funding: z.number().default(0),
  opened_at: z.string().nullable(),
  closed_at: z.string().min(1),
  notes: z.string().max(1000).nullable().optional(),
});

export const TradePatchInput = z.object({
  notes: z.string().max(1000).nullable().optional(),
  symbol: z.string().min(1).max(32).optional(),
  side: z.enum(["long", "short"]).optional(),
  qty: z.number().nullable().optional(),
  entry_price: z.number().nullable().optional(),
  close_price: z.number().nullable().optional(),
  realized_pnl: z.number().optional(),
  fee: z.number().optional(),
  funding: z.number().optional(),
  opened_at: z.string().nullable().optional(),
  closed_at: z.string().min(1).optional(),
});

// ============================================================
// Balance snapshots
// ============================================================

export const BalanceSnapshotInput = z.object({
  type: z.enum(["spot", "futures"]),
  value_usd: z.number(),
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
  note: z.string().max(500).optional(),
  is_delta: z.boolean().optional(),
});

// ============================================================
// Goal / settings
// ============================================================

export const GoalInput = z.object({
  goal_usd: z.number().min(0).nullable(),
  futures_start_usd: z.number().min(0).optional(),
});

// ============================================================
// Allowlist
// ============================================================

export const AllowlistInput = z.object({
  email: z.string().email("Некорректный email"),
  note: z.string().max(500).optional(),
});
