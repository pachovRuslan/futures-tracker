# Futures Tracker

Личный трекер фьючерсных сделок с автосинком через read-only API-ключи: **6 бирж** (Bybit, Binance, Bitget, Bitunix, BingX, MEXC), дашборд с PnL по месяцам, ручной учёт спот- и фьючерс-баланса, мультитенантная авторизация через Google и админка для управления пользователями. Next.js 16 + Supabase + Tailwind 4, деплой на Vercel.

> 📺 **Демо:** [https://futures-tracker-lake.vercel.app]`
---

## ✨ Возможности

- 🔄 **Автосинк 6 бирж** — Bybit, Binance, Bitget, Bitunix, BingX, MEXC. Каждая со своим адаптером подписи (HMAC-SHA256, SHA-512, base64), нарезкой окон и пагинацией.
- 🔐 **Шифрование API-ключей** — AES-256-GCM, ключ шифрования только в env сервера, никогда в БД. Сохранение ключа предваряется live-проверкой `testCredentials` реальным запросом к бирже.
- 📊 **Дашборд** — итоговый net PnL, win-rate, статистика выбранного месяца, кликабельный график PnL по месяцам, последние 5 сделок.
- 💸 **Ручные сделки** — для старых или внебиржевых сделок. Заметки сохраняются по `blur` и не затираются ресинком.
- 📈 **График баланса** — спот vs фьючерс, forward-fill, спред, линия цели. Только ручной ввод точек, режим «итог» или «дельта» (атомарный через RPC `apply_balance_delta`).
- 🎛️ **Фильтр бирж** — включай/выключай отдельные биржи из PnL-расчётов, состояние в `localStorage`.
- 🌗 **Светлая/тёмная/системная тема** — переключатель в шапке, без FOUC (скрипт применяет тему до первого рендера).
- 👥 **Мультитенантность** — каждый юзер видит только свои данные (RLS на уровне БД), cron-синк обходит всех пользователей с изоляцией ошибок.
- 🛡️ **Админка** — управление allowlist (БД + env fallback), таблица пользователей с PnL/подключениями, детальная страница пользователя.
- 🔒 **Безопасность** — RLS на всех таблицах, `security_definer` RPC с проверкой `admin_emails`, timing-safe сравнение `CRON_SECRET`, zod-валидация всех входящих JSON.

---

## 🧱 Технологии

| Слой | Технология |
|---|---|
| Фреймворк | **Next.js 16** (App Router, Server Components) |
| Язык | **TypeScript 5** (strict) |
| UI | **React 19**, **Tailwind CSS 4** (через `@tailwindcss/postcss`) |
| Графики | **Recharts 2** |
| БД / Auth | **Supabase** (Postgres, `@supabase/ssr`, Google OAuth) |
| Валидация | **Zod 4** — все POST/PUT/PATCH тела парсятся через `safeParse` |
| Шифрование | `crypto` (Node) — AES-256-GCM |
| Тесты | **Vitest 5** |
| Линт | **ESLint** + `eslint-config-next` |
| CI | **GitHub Actions** — TypeScript → ESLint → Tests → Build |
| Пакет-менеджер | **pnpm 12** |
| Деплой | **Vercel** (cron-jobs, region `fra1`) |

---

## 🏗 Архитектура

**Поток данных:**

```
BingX API ─┐
Bybit API ─┼─→ fetchWithRetry (timeout, retry, backoff)
Binance ───┤        ↓
Bitget ────┤   adapter.fetchClosedTrades() → SyncedTrade[]
Bitunix ───┤        ↓
MEXC ──────┘   syncUserExchange() → upsert в trades (unique user_id,exchange,external_id)
                       ↑
                Vercel Cron (Bearer $CRON_SECRET) / ручной запуск юзера
```

**Слои:**

- `lib/exchanges/*.ts` — адаптеры бирж. Каждый отвечает за подпись, маппинг в `SyncedTrade`, нарезку окон, пагинацию. Реестр в `lib/exchanges/index.ts`.
- `lib/sync.ts` — `fetchWithRetry`, `getSyncTargets` (расшифровка ключей), `syncUserExchange` (цикл пагинации), `syncAllUsers` (изоляция ошибок между юзерами), `summarizeResults`.
- `lib/auth.ts` — `authenticateSyncRequest`: cron-mode (timing-safe сравнение секрета) или user-mode (сессия Supabase).
- `lib/admin.ts` — `requireAdmin()` для всех `/api/admin/*`: проверка `admin_emails` в БД + fallback на env `ADMIN_EMAILS`.
- `lib/balance.ts` — расчёт исторического графика баланса (forward-fill spot/futures).
- `lib/trade-model.ts` — чистые функции бизнес-логики (форматирование, статистика, группировка). Unit-тестируется.
- `lib/validation.ts` — zod-схемы для всех API-роутов.
- `lib/crypto.ts` — `encrypt`/`decrypt`/`maskKey` (AES-256-GCM, iv + authTag + ciphertext).
- `middleware.ts` — проверка сессии Supabase + allowlist (БД + env) + admin-защита `/admin/*`.
- `app/api/**` — route handlers. Тонкие: auth → validate → вызов lib-функции → JSON.
- `supabase/migration_*.sql` — источник правды по схеме БД. `schema.sql` — устаревший v1-слепок, не использовать для новых инсталляций.

**Структура каталогов:**

```
futures-tracker/
├── app/
│   ├── page.tsx                  # Дашборд (итог + фильтр + графики + последние сделки)
│   ├── trades/page.tsx           # Таблица всех сделок, inline-редактирование заметок
│   ├── manual/page.tsx           # Форма ручных сделок
│   ├── balance/page.tsx          # Управление снапшотами spot/futures
│   ├── connections/page.tsx      # Подключение бирж (api key/secret/passphrase)
│   ├── admin/                    # Админка: allowlist + список пользователей + детали
│   ├── login/                    # OAuth через Google
│   ├── auth/callback/            # Обмен code на сессию (защита от open-redirect)
│   ├── not-allowed/              # 403-страница для незнакомых email-ов
│   └── api/
│       ├── sync/[exchange]/      # Ручной синк одной биржи (user-mode или cron)
│       ├── sync/cron/            # Cron-синк всех бирж всех юзеров
│       ├── trades/               # CRUD сделок (заметки — всем; поля — только manual)
│       ├── balance/              # Снапшоты баланса: absolute / delta (RPC)
│       ├── balance/chart/        # Готовый dataset для графика
│       ├── connections/          # CRUD подключений с валидацией ключа
│       ├── goal/                 # Настройки user_settings
│       └── admin/                # allowlist + users (RPC security_definer)
├── components/
│   ├── dashboard/                # PnLChart, MonthStats, SyncButton, ExchangeFilter, GraphTabs
│   ├── ui/                       # StatCard, PnlValue, SkeletonCard, ChartTooltip
│   ├── BalanceChart.tsx          # ComposedChart spot vs futures
│   ├── ThemeProvider.tsx         # Context темы (light/dark/system)
│   ├── ThemeToggle.tsx
│   └── SignOutButton.tsx
├── lib/
│   ├── exchanges/                # 6 адаптеров + index + types
│   ├── trade-model.ts            # Чистая бизнес-логика (.test.ts рядом)
│   ├── sync.ts                   # fetchWithRetry + syncUserExchange + syncAllUsers
│   ├── auth.ts                   # authenticateSyncRequest (cron / user)
│   ├── admin.ts                  # requireAdmin
│   ├── balance.ts                # getBalanceChartForUser
│   ├── crypto.ts                 # AES-256-GCM
│   ├── validation.ts             # zod-схемы
│   ├── types.ts                  # Trade, SyncedTrade, BalanceChartPoint, UserSettings
│   ├── supabase.ts               # service_role клиент (НИКОГДА не импортировать в браузер)
│   ├── supabase-server.ts        # SSR-клиент с cookies
│   └── supabase-browser.ts       # Браузерный клиент для OAuth
├── middleware.ts                 # Auth + allowlist + admin-защита
├── supabase/
│   ├── schema.sql                # ⚠️ Устаревший v1-слепок. Используй миграции 02-09.
│   ├── migration_02_rls.sql      # user_id + RLS на trades
│   ├── migration_03_exchange_connections.sql
│   ├── migration_04_new_exchanges.sql     # Binance/Bitget/BingX/MEXC + passphrase
│   ├── migration_05_balance_tracking.sql  # balance_snapshots + user_settings
│   ├── migration_06_admin_allowlist.sql   # allowed_emails + get_users_overview()
│   ├── migration_06b_allowlist_rls_policies.sql
│   ├── migration_07_admin_user_detail.sql # 3 RPC: by_id, stats, monthly
│   ├── migration_08_admin_rls_protection.sql  # admin_emails + admin-check в RPC
│   ├── migration_09_balance_delta_rpc.sql     # apply_balance_delta (atomic)
│   └── admin_queries.sql         # Справочные SQL-запросы для админки
├── .github/workflows/ci.yml      # TypeScript → ESLint → Vitest → Build
├── eslint.config.mjs
├── vitest.config.ts
├── vercel.json                   # region: fra1 + cron /api/sync/cron ежедневно
└── .env.example
```

---

## 🚀 Быстрый старт

### 1. Клонирование

```bash
git clone https://github.com/<твой-username>/futures-tracker.git
cd futures-tracker
pnpm install
```

### 2. Переменные окружения

```bash
cp .env.example .env.local
```

Заполни `.env.local`:

| Переменная | Назначение |
|---|---|
| `SUPABASE_URL` | URL проекта Supabase (серверный доступ) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ключ — обходит RLS, только для API-роутов |
| `NEXT_PUBLIC_SUPABASE_URL` | Тот же URL (для браузера/middleware) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) ключ — НЕ secret |
| `ALLOWED_EMAILS` | Email-ы через запятую, кому разрешён вход. Fallback к БД. |
| `ADMIN_EMAILS` | Email-ы админов через запятую. Отдельный список от allowlist. |
| `ENCRYPTION_KEY` | 32 байта base64 — для шифрования API-ключей бирж |
| `CRON_SECRET` | Случайная строка — Vercel шлёт её в `Authorization: Bearer` при запуске cron |
| `BITUNIX_SYMBOLS` | Список тикеров через запятую (опционально; пусто = все символы) |

Генерация ключей:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"     # CRON_SECRET
```

### 3. Настройка Supabase

1. Создай проект на [supabase.com](https://supabase.com) (free tier).
2. **Authentication → Sign In / Providers → Google** — включи, вставь OAuth Client ID/Secret из Google Cloud Console.
3. **Authentication → URL Configuration → Redirect URLs** — добавь:
   - `http://localhost:3000/auth/callback` (для локалки)
   - `https://<твой-домен>.vercel.app/auth/callback` (для прода)
4. **SQL Editor** — выполни миграции **по порядку**:
   ```sql
   -- 1. Базовая схема (устаревший, но отправная точка):
   --    supabase/schema.sql
   -- 2. Затем по очереди:
   supabase/migration_02_rls.sql
   supabase/migration_03_exchange_connections.sql
   supabase/migration_04_new_exchanges.sql
   supabase/migration_05_balance_tracking.sql
   supabase/migration_06_admin_allowlist.sql
   supabase/migration_06b_allowlist_rls_policies.sql
   supabase/migration_07_admin_user_detail.sql
   supabase/migration_08_admin_rls_protection.sql
   supabase/migration_09_balance_delta_rpc.sql
   ```
   ⚠️ В `migration_02_rls.sql` замени `<твой-email>@gmail.com` на свой перед выполнением шага 2 (backfill).
5. После миграции 08 — добавь себя в админы:
   ```sql
   insert into admin_emails (email, note) values ('you@gmail.com', 'main admin');
   insert into allowed_emails (email, note) values ('you@gmail.com', 'main admin');
   ```

### 4. Локальный запуск

```bash
pnpm dev
# Открой http://localhost:3000 → редирект на /login → Google OAuth
```

### 5. Деплой на Vercel

1. Запушь репозиторий в GitHub.
2. [vercel.com](https://vercel.com) → **Add New → Project** → импортируй репозиторий (Vercel сам определит Next.js).
3. **Project Settings → Environment Variables** — добавь все переменные из `.env.example`.
4. **Deploy**. Cron-задача `/api/sync/cron` подхватится из `vercel.json` (ежедневно в 00:00 UTC).

---

## 📊 Поддерживаемые биржи

| Биржа | Эндпоинт | Подпись | Окна | Пагинация | Особенности |
|---|---|---|---|---|---|
| **Bybit** | `/v5/position/closed-pnl` (V5, linear) | HMAC-SHA256 (hex) | 7 дней | cursor | `closedPnl` уже включает fee; side инвертирован (закрывающий ордер) |
| **Binance** | `/fapi/v1/income` + `/fapi/v1/userTrades` | HMAC-SHA256 (hex) | 7 дней | `fromId` | PnL/fee/funding — три отдельных запроса; матчинг по `orderId` |
| **Bitget** | `/api/v2/mix/position/history-position` | HMAC-SHA256 (base64) + passphrase | нет | `idLess` | Timestamp с сервера Bitget (защита от рассинхрона) |
| **Bitunix** | `/api/v1/futures/position/get_history_positions` | Двойной SHA-256 с nonce | нет | `skip/limit` | Агрегация partials по `positionId`; символы из env `BITUNIX_SYMBOLS` |
| **BingX** | `/openApi/swap/v2/user/income` | HMAC-SHA256 (hex) | 7 дней | по времени | income endpoint (не positionHistory — тот пустой у части аккаунтов); группировка по `tradeId` |
| **MEXC** | `/api/v1/private/position/list/history-position` | HMAC-SHA256 (hex) | нет | `pageNum/pageSize` | Готовые `fee`, `fundingAmount`, `realizedAmount` |

Все адаптеры реализуют интерфейс `ExchangeAdapter` (см. `lib/exchanges/types.ts`) и регистрируются в `lib/exchanges/index.ts`. Для добавления новой биржи:

1. Создай `lib/exchanges/<name>.ts` с реализацией `fetchClosedTrades` + `testCredentials`.
2. Добавь идентификатор в `EXCHANGES` (index.ts) и в `Exchange` union (types.ts).
3. Зарегистрируй адаптер в `REGISTRY`.
4. Расширь CHECK constraint в БД (новая миграция).

---

## 🗄 Структура БД

| Таблица | Назначение |
|---|---|
| `trades` | Все сделки (синканные и ручные). `unique(user_id, exchange, external_id)` для идемпотентного upsert. |
| `exchange_connections` | Подключения бирж юзеров. `api_key_encrypted`, `api_secret_encrypted`, `passphrase_encrypted` (для Bitget). |
| `balance_snapshots` | Ручные точки баланса (spot/futures). `unique(user_id, type, snapshot_date)`. |
| `user_settings` | `goal_usd` (линия цели на графике) и `futures_start_usd` (legacy, не используется). |
| `allowed_emails` | Allowlist входа. Управляется через `/admin` или env `ALLOWED_EMAILS`. |
| `admin_emails` | Список админов. Проверяется в `security_definer` RPC + env `ADMIN_EMAILS`. |
| `monthly_summary` (view) | Агрегаты по месяцам с `security_invoker = true` (RLS-aware). |
| `get_users_overview()` | RPC: все юзеры с подключениями + статистикой (admin-only). |
| `get_user_by_id()` / `get_user_trades_stats()` / `get_user_monthly_summary()` | RPC детальной страницы юзера в админке (admin-only). |
| `apply_balance_delta()` | Атомарный delta-upsert баланса через `SELECT FOR SHARE` (защита от race condition). |

---

## 🔐 Безопасность

- **Row Level Security** на всех таблицах с пользовательскими данными. Даже баг в коде не позволит прочитать чужие сделки — Postgres сам откажет.
- **`security_definer` RPC с admin-чеком** — `get_users_overview`, `get_user_by_id` и др. проверяют `admin_emails` в CTE; не-админу возвращают пустой результат.
- **AES-256-GCM шифрование** API-ключей. IV (12 байт) + authTag (16 байт) + ciphertext, всё в одной base64-строке. Ключ — только в env сервера, никогда в БД.
- **Zod-валидация** всех POST/PUT/PATCH тел через `safeParse`. Невалидный запрос → 400 с конкретными ошибками полей.
- **Timing-safe сравнение** `CRON_SECRET` через `crypto.timingSafeEqual` (lib/auth.ts) — защита от атак по времени.
- **Защита от open-redirect** в `/auth/callback` — `safeNext()` пропускает только относительные пути без `//` и `://`.
- **Fail-closed allowlist** — если email не найден ни в БД, ни в env, доступ запрещён. Пустой allowlist никого не пускает.
- **Masked key preview** — в БД хранится `key_preview` вида `•••• 4811`, никогда полный ключ. API никогда не отдаёт `*_encrypted` колонки наружу.
- **Defensive coding** — везде, где RLS уже защищает, route handler дублирует фильтр `eq("user_id", user.id)`. Если в RLS появится баг, фильтр в коде подстрахует.
- **Read-only API-ключи** — форма подключения явно предупреждает: ключи бирж должны быть только на чтение истории сделок.

---

## 🌍 Деплой

### Vercel

1. Импортируй репозиторий на [vercel.com](https://vercel.com).
2. Environment Variables — добавь все из `.env.example`.
3. `vercel.json` уже сконфигурирован:
   - `regions: ["fra1"]` — Frankfurt (Bybit/Binance блокируют US-регион).
   - `crons: [{ path: "/api/sync/cron", schedule: "0 0 * * *" }]` — ежедневный синк всех бирж всех юзеров в 00:00 UTC.
4. Cron использует `Authorization: Bearer $CRON_SECRET` — Vercel автоматически подставляет переменную.

### Регион

`fra1` обязателен — Bybit и Binance блокируют API-запросы из US-региона (Vercel Hobby по умолчанию использует `iad1`). Если увидишь `CloudFront distribution is configured to block access from your country` — проверь, что регион не сбросился.

### Лимиты Vercel Hobby

- Cron: 2 задачи на free-плане. У нас одна (`/api/sync/cron`).
- Function duration: 60 сек (`maxDuration = 60` в sync-роутах). При росте числа юзеров этого не хватит — нужен переход на QStash/Supabase Queue (см. Roadmap).

---

## 🧪 Тестирование

```bash
pnpm test          # один прогон (vitest run)
pnpm test:watch    # watch-режим
```

Покрытие:

- `lib/trade-model.test.ts` — чистая бизнес-логика: `tradeNetPnl`, `calculateMonthStats`, `calculateAllTimeWinRate`, `calculateTotalNetPnl`, `groupTradesByMonth`, `getActiveMonth`, форматирование (`fmt`, `fmtPnl`, `fmtFee`, `fmtDate`).

CI (`.github/workflows/ci.yml`) прогоняет на каждом push/PR в `main`:

1. `npx tsc --noEmit` — typecheck
2. `pnpm lint` — ESLint
3. `pnpm test` — Vitest
4. `pnpm build` — production-сборка с fake env-переменными

---

## 📝 Лицензия

[MIT](LICENSE) © 2026

---

## 🗺 Roadmap

- [ ] **Per-user символы Bitunix** — хранить список тикеров в `exchange_connections` вместо общего env `BITUNIX_SYMBOLS`.
- [ ] **`last_synced_at`** — delta-синк только новых сделок с прошлого запуска, а не 365 дней каждый раз.
- [ ] **Очередь синка** — переход на QStash/Supabase Queue при росте числа юзеров свыше лимита 60 сек.
- [ ] **Мониторинг** — алерт в Telegram/email, если cron-синк упал 3 раза подряд.
- [ ] **По-bitunix-fills детализация** — UI-режим «позиция закрыта в N partials» с разворачиванием.
- [ ] **Bybit fee через `/v5/account/transaction-log`** — сейчас `fee=0` (closedPnl уже включает комиссию), но для расчёта баланса нужна раздельная статистика.
- [ ] **OKX / KuCoin / Coinbase Advanced Trade** — типы `CredentialsSchema` уже подготовлены (`key+secret+passphrase`, `key+privatekey`).
- [ ] **Экспорт CSV / интеграция с Google Sheets** — для бухгалтерии и налогов.
- [ ] **PWA** — оффлайн-кеш дашборда, push-уведомления о крупных PnL.
