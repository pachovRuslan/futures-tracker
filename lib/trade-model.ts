import type { Trade, Exchange } from "@/lib/types";

/**
 * Бизнес-логика расчётов по сделкам — чистые функции без React.
 * Используются на дашборде и в админке, можно unit-тестировать.
 *
 * Принципы:
 * - Все функции чистые (pure) — нет side effects, зависят только от входных данных
 * - Возвращают примитивы/объекты, НЕ React-элементы
 * - Форматирование (fmt, fmtPnl) — тоже здесь, для переиспользования
 */

// ============================================================
// Форматирование
// ============================================================

export function fmt(n: number): string {
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function fmtPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "$" + n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateLong(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtFee(fee: number, exchange: string): string {
  if (exchange === "bybit" && fee === 0) return "—";
  return fee.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

// ============================================================
// Базовые операции со сделками
// ============================================================

/** Net PnL одной сделки = realized_pnl - fee + funding */
export function tradeNetPnl(t: Trade): number {
  return t.realized_pnl - t.fee + t.funding;
}

/** Отфильтровать сделки по выбранным биржам */
export function filterTradesByExchanges(
  trades: Trade[],
  selected: Set<string>
): Trade[] {
  return trades.filter((t) => selected.has(t.exchange));
}

// ============================================================
// Статистика за месяц
// ============================================================

export interface MonthStatsData {
  tradesCount: number;
  winCount: number;
  lossCount: number;
  winRate: string;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  fee: number;
  funding: number;
}

/** Статистика сделок за конкретный месяц (YYYY-MM) */
export function calculateMonthStats(trades: Trade[], month: string): MonthStatsData {
  const monthTrades = trades.filter((t) => t.closed_at.slice(0, 7) === month);
  const netPnls = monthTrades.map(tradeNetPnl);
  const winCount = netPnls.filter((p) => p > 0).length;
  const lossCount = netPnls.filter((p) => p <= 0).length;
  const total = monthTrades.length;

  return {
    tradesCount: total,
    winCount,
    lossCount,
    winRate: total > 0 ? ((winCount / total) * 100).toFixed(1) : "0",
    netPnl: netPnls.reduce((a, b) => a + b, 0),
    grossProfit: netPnls.filter((p) => p > 0).reduce((a, b) => a + b, 0),
    grossLoss: netPnls.filter((p) => p <= 0).reduce((a, b) => a + b, 0),
    fee: monthTrades.reduce((acc, t) => acc + t.fee, 0),
    funding: monthTrades.reduce((acc, t) => acc + t.funding, 0),
  };
}

// ============================================================
// Win-rate за всё время
// ============================================================

/** Win-rate по всем сделкам — доля прибыльных (net PnL > 0) */
export function calculateAllTimeWinRate(trades: Trade[]): string {
  if (trades.length === 0) return "0";
  const netPnls = trades.map(tradeNetPnl);
  const winCount = netPnls.filter((p) => p > 0).length;
  return ((winCount / netPnls.length) * 100).toFixed(1);
}

// ============================================================
// Итоговый PnL
// ============================================================

/** Суммарный net PnL по всем сделкам */
export function calculateTotalNetPnl(trades: Trade[]): number {
  return trades.reduce((acc, t) => acc + tradeNetPnl(t), 0);
}

// ============================================================
// График PnL по месяцам
// ============================================================

export interface MonthlyChartData {
  month: string;
  netPnl: number;
  trades: number;
}

/** Группировка сделок по месяцам для графика (отсортировано по возрастанию) */
export function groupTradesByMonth(trades: Trade[]): MonthlyChartData[] {
  const byMonth = new Map<string, { netPnl: number; trades: number }>();
  for (const t of trades) {
    const month = t.closed_at.slice(0, 7);
    const net = tradeNetPnl(t);
    const existing = byMonth.get(month) ?? { netPnl: 0, trades: 0 };
    existing.netPnl += net;
    existing.trades += 1;
    byMonth.set(month, existing);
  }
  return Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, netPnl: v.netPnl, trades: v.trades }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ============================================================
// Утилиты для активного месяца
// ============================================================

/**
 * Активный месяц = выбранный пользователем или самый свежий.
 * Свежий = последний элемент отсортированного по возрастанию массива.
 */
export function getActiveMonth(
  selectedMonth: string | null,
  chartData: MonthlyChartData[]
): string | null {
  return selectedMonth ?? chartData[chartData.length - 1]?.month ?? null;
}
