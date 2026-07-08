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
3. В **Project Settings → Environment Variables** добавить все переменные из `.env.example` (включая `APP_BASIC_AUTH_USER`/`PASSWORD` — без них Basic Auth будет выключена).
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

По умолчанию синкается год назад (`days=365`). Чтобы забрать более глубокую историю разово — дёрни вручную (например, через браузер, пока залогинен через Basic Auth):
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

## Структура

```
app/
  page.tsx            — дашборд (сводка + график по месяцам)
  trades/page.tsx      — таблица сделок с фильтром по бирже
  api/sync/bybit/      — синк с Bybit
  api/sync/bitunix/    — синк с Bitunix
  api/trades/          — чтение сделок + месячной сводки
lib/
  exchanges/           — клиенты бирж (подпись + маппинг в общий формат Trade)
  supabase.ts          — server-side клиент Supabase
  types.ts             — общие типы
supabase/schema.sql     — таблица trades + вьюха monthly_summary
middleware.ts           — Basic Auth защита всего приложения
vercel.json              — конфиг cron-задач на автосинк
```
