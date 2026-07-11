import type { ExchangeAdapter, Exchange } from "./types";
import { bybitAdapter } from "./bybit";
import { bitunixAdapter } from "./bitunix";
import { binanceAdapter } from "./binance";
import { bitgetAdapter } from "./bitget";
import { bingxAdapter } from "./bingx";
import { mexcAdapter } from "./mexc";

/**
 * Список поддерживаемых бирж.
 *
 * ВАЖНО: при добавлении биржи нужно:
 *   1. Добавить её в этот массив
 *   2. Реализовать адаптер в lib/exchanges/<name>.ts
 *   3. Добавить в REGISTRY ниже
 *   4. Добавить в Exchange union в lib/exchanges/types.ts
 *   5. Обновить CHECK constraint в БД (миграция)
 *
 * "manual" сюда НЕ входит — это не настоящая биржа, а ручные сделки.
 */
export const EXCHANGES: Exchange[] = [
  "bybit",
  "bitunix",
  "binance",
  "bitget",
  "bingx",
  "mexc",
];

/**
 * Реестр адаптеров. Один источник правды — route handler /api/sync/[exchange]
 * просто делает REGISTRY[params.exchange] и работает с адаптером.
 */
export const REGISTRY: Record<Exchange, ExchangeAdapter> = {
  bybit: bybitAdapter,
  bitunix: bitunixAdapter,
  binance: binanceAdapter,
  bitget: bitgetAdapter,
  bingx: bingxAdapter,
  mexc: mexcAdapter,
  // manual не имеет адаптера — это не настоящая биржа.
  // Но Record<Exchange, ...> требует ключ для manual — ставим заглушку,
  // которая бросает ошибку, если кто-то попытается её использовать.
  manual: {
    id: "manual",
    label: "Manual",
    credentialsSchema: "key+secret",
    fetchClosedTrades: async () => {
      throw new Error("manual — не настоящая биржа, синк не поддерживается");
    },
    testCredentials: async () => {
      throw new Error("manual — не настоящая биржа");
    },
  },
};

/**
 * Список реальных бирж (без manual) для UI — форма подключения, фильтры.
 */
export function getExchangeList(): { id: Exchange; label: string }[] {
  return EXCHANGES.map((id) => ({ id, label: REGISTRY[id].label }));
}

/**
 * Проверка, что строка — валидный идентификатор биржи (без manual).
 */
export function isValidExchange(value: string): value is Exchange {
  return (EXCHANGES as string[]).includes(value);
}
