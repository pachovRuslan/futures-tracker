-- ============================================================
-- Миграция 3: пользовательские подключения к биржам
-- ============================================================

create table if not exists exchange_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exchange text not null check (exchange in ('bybit', 'bitunix')),
  -- Зашифровано на сервере (AES-256-GCM, ключ в ENCRYPTION_KEY, НЕ в базе).
  -- Даже полный дамп этой таблицы бесполезен без ключа из env.
  api_key_encrypted text not null,
  api_secret_encrypted text not null,
  key_preview text not null, -- последние 4 символа ключа, для UI ("•••• 4811")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exchange)
);

alter table exchange_connections enable row level security;

drop policy if exists "Users can view own connections" on exchange_connections;
drop policy if exists "Users can insert own connections" on exchange_connections;
drop policy if exists "Users can update own connections" on exchange_connections;
drop policy if exists "Users can delete own connections" on exchange_connections;

-- ВАЖНО: даже с этими policy колонки *_encrypted всё равно попадут в JSON
-- ответа, если запрашивать через обычный select "*" с сессионным ключом.
-- Поэтому в коде (app/api/connections) чтение списка подключений идёт
-- ТОЛЬКО через отдельный API-роут, который явно выбирает нешифрованные
-- поля (exchange, key_preview, created_at) — колонки с ключами наружу
-- никогда не отдаются, даже себе самому.
create policy "Users can view own connections" on exchange_connections
  for select using (auth.uid() = user_id);

create policy "Users can insert own connections" on exchange_connections
  for insert with check (auth.uid() = user_id);

create policy "Users can update own connections" on exchange_connections
  for update using (auth.uid() = user_id);

create policy "Users can delete own connections" on exchange_connections
  for delete using (auth.uid() = user_id);
