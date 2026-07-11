import type { SyncedTrade } from "@/lib/types";

/**
 * Схема учётных данных биржи.
 *   - "key+secret"            — Bybit, Binance, MEXC, BingX
 *   - "key+secret+passphrase" — Bitget, OKX, KuCoin (пока не используем, задел на будущее)
 *   - "key+privatekey"        — Coinbase Advanced Trade (JWT ES256, не HMAC)
 */
export type CredentialsSchema = "key+secret" | "key+secret+passphrase" | "key+privatekey";

/**
 * Унифицированные учётные данные. passphrase/privateKey опциональны —
 * нужны только для бирж с соответствующей схемой.
 */
export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  privateKey?: string;
}

/**
 * Общий интерфейс адаптера биржи.
 *
 * Каждый адаптер отвечает за:
 *   - подпись запросов к бирже (HMAC-SHA256/SHA512, JWT и т.д.)
 *   - маппинг ответа в унифицированный SyncedTrade
 *   - нарезку окон/пагинацию (специфика биржи живёт ЗДЕСЬ, а не в route handler)
 *   - валидацию ключа перед сохранением (testCredentials)
 *
 * Адаптер НЕ отвечает за:
 *   - чтение из БД / расшифровку ключей (это lib/sync.ts)
 *   - запись в trades (это route handler)
 *   - изоляцию ошибок между пользователями (это lib/sync.ts)
 */
export interface ExchangeAdapter {
  /** Идентификатор биржи — должен совпадать со значением в Exchange union и БД. */
  id: Exchange;

  /** Человекочитаемое название для UI. */
  label: string;

  /** Схема учётных данных — определяет, какие поля рендерить в форме подключения. */
  credentialsSchema: CredentialsSchema;

  /**
   * Тянуть закрытые сделки начиная с курсора/временного окна.
   *
   * Адаптер сам отвечает за нарезку окон (если биржа требует, как Bybit с 7-дневным
   * лимитом) и пагинацию внутри окон. route handler просто вызывает fetchClosedTrades
   * в цикле, пока nextCursor !== null.
   *
   * Параметры:
   *   - sinceMs: тянуть сделки после этого момента (для delta-синка)
   *   - untilMs: тянуть сделки до этого момента (обычно now)
   *   - cursor: курсор пагинации от предыдущего вызова
   *
   * Возвращает:
   *   - trades: массив унифицированных сделок (БЕЗ user_id — его добавит route handler)
   *   - nextCursor: null если достигли конца, иначе курсор для следующей страницы
   *
   * Опциональные параметры-фильтры (например, symbols для Bitunix) читаются из env.
   */
  fetchClosedTrades(
    credentials: ExchangeCredentials,
    opts?: {
      sinceMs?: number;
      untilMs?: number;
      cursor?: string;
    }
  ): Promise<{ trades: SyncedTrade[]; nextCursor: string | null }>;

  /**
   * Лёгкая проверка валидности ключа — дёргает эндпоинт с limit=1.
   * Бросает Error, если ключ невалиден.
   */
  testCredentials(credentials: ExchangeCredentials): Promise<void>;
}

/**
 * Тип Exchange объявлен ЗДЕСЬ (а не в index.ts), чтобы избежать циклического
 * импорта (types.ts ← index.ts ← types.ts). Массив EXCHANGES в index.ts должен
 * быть синхронизирован с этим union — иначе тайпчек падает.
 *
 * "manual" добавлен отдельно — это не настоящая биржа, а ручные сделки юзера.
 *
 * При добавлении биржи: добавьте её И в массив EXCHANGES (index.ts), И в union
 * ниже. На практике они синхронизированы, потому что адаптеры ссылаются на тип.
 */
export type Exchange =
  | "bybit"
  | "bitunix"
  | "binance"
  | "bitget"
  | "bingx"
  | "mexc"
  | "manual";
