# Futures Tracker

Личный трекер фьючерсных сделок с Bybit и Bitunix: авто-синк по read-only API-ключам, список сделок, месячная сводка.

## Запуск локально

```bash
pnpm install
cp .env.example .env.local   # заполнить ключи
pnpm dev
```

## Supabase

1. Создать проект на supabase.com (бесплатный tier).
2. В SQL Editor выполнить `supabase/schema.sql`.
3. Взять `Project URL` и `service_role` ключ (Settings → API) → `.env.local`.

## Деплой (Vercel)

1. Запушить проект в GitHub-репозиторий.
2. На vercel.com → **Add New → Project** → импортировать репозиторий (Vercel сам определит Next.js, никаких доп. настроек сборки не требуется).
3. В **Project Settings → Environment Variables** добавить все переменные из `.env.example`, включая `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`ALLOWED_EMAILS` — без них никто не сможет залогиниться (см. раздел про Google Auth ниже).
4. Deploy.

`vercel.json` уже содержит cron-задачи на синк каждые 15 минут — они дёргают `/api/sync/bybit` и `/api/sync/bitunix` напрямую. Проверить, что крон подхватился — в панели проекта, вкладка **Settings → Cron Jobs**.

**Важно:** лимиты по частоте cron-джобов на бесплатном Hobby-плане Vercel периодически меняются. Перед деплоем стоит свериться с актуальными лимитами в Vercel Dashboard → Settings → Cron Jobs; если 15 минут окажутся недоступны на твоём плане, можно временно дергать те же роуты внешним крон-сервисом (cron-job.org) или просто кнопкой "Синк" в интерфейсе.

## Обновление уже задеплоенного проекта (миграция БД)

Если `schema.sql` уже был накатан раньше — в Supabase SQL Editor выполни:

```sql
alter table trades drop constraint if exists trades_exchange_check;
alter table trades add constraint trades_exchange_check check (exchange in ('bybit', 'bitunix', 'manual'));
alter table trades add column if not exists notes text;
```

## Регион Vercel-функций

`vercel.json` закрепляет функции за Frankfurt (`fra1`) — Bybit блокирует API-запросы из США по регуляторным причинам, а Vercel Hobby по умолчанию использует `iad1` (US East). Если увидишь ошибку вида `CloudFront distribution is configured to block access from your country` — проверь, что регион в `vercel.json` не сброшен обратно на дефолтный.

## Backfill истории Bybit

`/v5/position/closed-pnl` у Bybit жёстко ограничен диапазоном `endTime - startTime <= 7 дней`, а без явных `startTime`/`endTime` отдаёт вообще только последние 24 часа. Поэтому `/api/sync/bybit` сам нарезает период на 7-дневные окна.

По умолчанию синкается год назад (`days=365`). Чтобы забрать более глубокую историю разово — дёрни вручную (например, через браузер, пока залогинен через Google):
```
https://твой-домен.vercel.app/api/sync/bybit?days=730
```
Дубли не создаются — таблица использует `unique(exchange, external_id)` и upsert.

## Ручные сделки и заметки

- Вкладка **"Добавить сделку"** — форма для сделок, которые не пришли по API (старые сделки, сделки без ключей и т.д.). Хранятся как `exchange = 'manual'`, их можно удалять — синканные с биржи сделки удалить нельзя (появятся заново на следующем синке).
- В таблице **"Сделки"** у каждой строки (включая синканные) есть редактируемое поле **"Заметки"** — сохраняется по blur, при следующем синке не перезатирается (upsert обновляет только те колонки, которые реально передаются в запросе, `notes` туда не входит).


- **Bybit**: `/v5/position/closed-pnl`, категория `linear` (USDT-перпетуалы). Подпись — стандартный HMAC-SHA256. `closedPnl` в ответе уже учитывает комиссию, поэтому `fee` в БД пишется как 0, чтобы не задваивать вычет — если увидишь расхождение с реальным балансом, можно поправить в `lib/exchanges/bybit.ts`.
- **Bitunix**: `/api/v1/futures/position/get_history_positions`. Подпись своя (двойной SHA-256 с nonce), детали в `lib/exchanges/bitunix.ts`. Если API требует `symbol` обязательным параметром — список тикеров задаётся через `BITUNIX_SYMBOLS` в `.env`.
- Оба клиента писались по официальной документации на момент создания проекта (июль 2026) — перед боевым использованием стоит прогнать один тестовый синк и свериться вручную с 2-3 сделками, т.к. биржи периодически меняют формат ответов.

## Авторизация через Google (шаг 1 из плана мультитенантности)

Basic Auth заменён на настоящий логин через Supabase Auth + Google. Пока это **не полноценная мультитенантность** — все пользователи из `ALLOWED_EMAILS` видят одни и те же данные (таблица `trades` пока без `user_id`). Это нужно для следующего шага, чтобы не переделывать всё разом.

**Настройка:**

1. **Google Cloud Console** → создать OAuth 2.0 Client ID (тип "Web application").
   - Authorized redirect URI: `https://<project-id>.supabase.co/auth/v1/callback`
   - Сохранить Client ID и Client Secret.
2. **Supabase Dashboard** → Authentication → Sign In / Providers → Google → включить, вставить Client ID/Secret из шага 1.
3. **Supabase Dashboard** → Authentication → URL Configuration → добавить в Redirect URLs:
   - `http://localhost:3000/auth/callback` (для локальной разработки)
   - `https://твой-домен.vercel.app/auth/callback` (для продакшена)
4. В `.env.local` / Vercel env добавить:
   - `NEXT_PUBLIC_SUPABASE_URL` — тот же URL, что и `SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — берётся в Settings → API Keys → **Publishable key** (НЕ secret!)
   - `ALLOWED_EMAILS` — твой email через запятую (если несколько человек — все через запятую). **Не оставляй пустым в продакшене**, иначе войти сможет кто угодно с Google-аккаунтом.
5. `pnpm install` (подтянет `@supabase/ssr`), `pnpm dev`, проверить `/login`.

## Шаг 2: RLS + user_id (мультитенантность на уровне БД)

Теперь каждая сделка привязана к конкретному пользователю (`user_id`), и Postgres Row Level Security физически не даёт прочитать/изменить чужие сделки — даже если в коде где-то будет баг, база сама откажет в доступе.

**Порядок действий (важно соблюдать именно так):**

1. Убедись, что уже хотя бы раз залогинился через Google на сайте (после шага 1) — иначе некому будет привязать существующие сделки.
2. Открой `supabase/migration_02_rls.sql`, в шаге 2 (`update trades set user_id = ...`) замени email в кавычках на свой (тот, которым логинишься через Google).
3. Выполни миграцию в Supabase SQL Editor **по частям**: сначала шаги 1-3 (добавление колонки, backfill, проверка), глянь результат `select count(*) ...` — если 0, дальше можно выполнять шаги 4-7 целиком. Если не 0 — где-то разошёлся email, не выполняй `alter column ... set not null`, пока не поправишь.
4. В Supabase Dashboard → Authentication → Users найди свою запись, скопируй значение из колонки **UID** (это `auth.users.id`).
5. Добавь в `.env.local` и в Vercel env:
   ```
   SYNC_USER_ID=<скопированный UID>
   ```
   **С шагом 4 (мультитенантный синк) эта переменная больше не используется** — cron сам обходит все `exchange_connections`. Можно не заполнять, оставлено только для совместимости со старыми деплоями.
6. Перезапусти `pnpm dev` (или редеплой на Vercel), проверь, что дашборд и синк работают как раньше.

## Шаг 3: пользовательские API-ключи бирж

Ключи Bybit/Bitunix больше не лежат в env — вводятся через UI (страница **"Подключения"**), проверяются реальным запросом к бирже перед сохранением, и хранятся в БД зашифрованными (AES-256-GCM, ключ шифрования — только в env сервера, никогда в БД).

**Настройка:**

1. Сгенерируй ключ шифрования:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Добавь в `.env.local` и в Vercel env:
   ```
   ENCRYPTION_KEY=<результат команды выше>
   ```
   **Не теряй этот ключ** и не меняй его, когда уже сохранил подключения — без него зашифрованные ключи бирж не расшифровать, придётся переподключать биржи заново.
3. В Supabase SQL Editor выполни `supabase/migration_03_exchange_connections.sql`.
4. `BYBIT_API_KEY`/`BYBIT_API_SECRET`/`BITUNIX_API_KEY`/`BITUNIX_API_SECRET` можно убрать из env — больше не используются (`BITUNIX_SYMBOLS` пока остаётся в env, список символов общий для всех пользователей — это шаг 5 дорожной карты).
5. `pnpm dev`, зайди на `/connections`, подключи Bybit и Bitunix заново (те же ключи, что были в env) — форма сама проверит их перед сохранением.
6. Нажми "Синк" на дашборде — теперь ключи читаются из БД.

## Дорожная карта до полноценного мультитенантного SaaS

1. ✅ Google Auth — вход настоящий, allowlist по email.
2. ✅ RLS + `user_id` — данные физически изолированы на уровне БД.
3. ✅ Пользовательские API-ключи бирж — форма подключения, шифрование в БД, валидация перед сохранением.
4. ✅ **Синк по всем пользователям** — cron-роуты обходят все строки `exchange_connections` и синкают каждого пользователя отдельно. Ошибки изолированы: если у одного ключ стал невалидным, остальные всё равно просинкаются. `SYNC_USER_ID` больше не нужен.

### Что дальше (шаг 5+)

- **Per-user символы Bitunix** — сейчас `BITUNIX_SYMBOLS` общий для всех из env. Если у разных юзеров разные торгуемые пары, нужно хранить их в `exchange_connections`.
- **Очередь синка** — при росте числа пользователей 60-секундного лимита Vercel function не хватит на последовательный синк. Перенести в Supabase Queue или QStash с параллельной обработкой.
- **`last_synced_at`** в `exchange_connections` — чтобы не тянуть 365 дней каждый раз, а синкать только дельту с прошлого запуска.
- **Мониторинг** — алерт в Telegram/email если cron-синк упал 3 раза подряд.

## Структура

```
app/
  page.tsx            — дашборд (сводка + график по месяцам)
  trades/page.tsx      — таблица сделок с фильтром по бирже
  manual/page.tsx      — форма добавления сделок вручную
  connections/page.tsx  — управление подключениями к биржам
  login/page.tsx        — страница входа (Google)
  auth/callback/        — обмен OAuth-кода на сессию Supabase
  api/sync/bybit/      — синк с Bybit
  api/sync/bitunix/    — синк с Bitunix
  api/trades/          — чтение/создание сделок + месячной сводки
  api/trades/[id]/      — редактирование заметок, удаление ручных сделок
  api/connections/      — список/добавление подключений к биржам
  api/connections/[exchange]/ — отключение биржи
lib/
  exchanges/           — клиенты бирж (подпись + маппинг в общий формат Trade)
  supabase.ts          — server-side клиент Supabase (service_role, для синка)
  supabase-browser.ts   — Supabase-клиент для браузера (Auth)
  supabase-server.ts    — Supabase-клиент для Server Components/route handlers (Auth)
  crypto.ts             — AES-256-GCM шифрование ключей бирж
  types.ts             — общие типы
components/SignOutButton.tsx — кнопка выхода из аккаунта
supabase/schema.sql     — таблица trades + вьюха monthly_summary
supabase/migration_02_rls.sql — миграция: user_id + RLS
supabase/migration_03_exchange_connections.sql — миграция: таблица подключений к биржам
middleware.ts           — проверка сессии Supabase Auth (Google) + allowlist по email
vercel.json              — конфиг cron-задач на автосинк
```
