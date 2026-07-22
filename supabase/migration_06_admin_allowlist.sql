-- ============================================================
-- Миграция 6: allowlist в БД для админки
-- ============================================================

-- 1. Таблица allowlist — кому разрешён вход через Google Auth.
--    Раньше ALLOWED_EMAILS хранился в env, теперь — в БД, чтобы
--    можно было добавлять/удалять через админку без редеплоя.
create table if not exists allowed_emails (
  email text primary key,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  note text
);

alter table allowed_emails enable row level security;

-- Все залогиненные пользователи могут читать allowlist (нужно middleware
-- для проверки, что юзер в списке). Запись/удаление — только через
-- service_role в API-роутах (RLS для INSERT/UPDATE/DELETE нет вообще,
-- потому что только админы дёргают эти роуты, и проверка идёт в коде).
drop policy if exists "Anyone authenticated can read allowlist" on allowed_emails;
create policy "Anyone authenticated can read allowlist" on allowed_emails
  for select using (auth.uid() is not null);

-- 2. SQL-функция: список всех пользователей с подключениями и сделками.
--    Используется в /api/admin/users. security_definer — чтобы функция
--    могла читать auth.users и чужие trades/exchange_connections в обход RLS
--    (админ видит всех).
create or replace function get_users_overview()
returns table (
  email text,
  user_id uuid,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  bybit bigint,
  bitunix bigint,
  binance bigint,
  bitget bigint,
  bingx bigint,
  mexc bigint,
  total_connections bigint,
  last_connection_at timestamptz,
  trades_count bigint,
  last_trade_at timestamptz,
  total_net_pnl numeric
)
language sql security definer as $$
  select
    u.email,
    u.id,
    u.created_at,
    u.last_sign_in_at,
    count(ec.id) filter (where ec.exchange = 'bybit'),
    count(ec.id) filter (where ec.exchange = 'bitunix'),
    count(ec.id) filter (where ec.exchange = 'binance'),
    count(ec.id) filter (where ec.exchange = 'bitget'),
    count(ec.id) filter (where ec.exchange = 'bingx'),
    count(ec.id) filter (where ec.exchange = 'mexc'),
    count(ec.id),
    max(ec.created_at),
    count(t.id),
    max(t.closed_at),
    coalesce(sum(t.realized_pnl - t.fee + t.funding), 0)
  from auth.users u
  left join exchange_connections ec on ec.user_id = u.id
  left join trades t on t.user_id = u.id
  group by u.email, u.id, u.created_at, u.last_sign_in_at
  order by u.created_at desc;
$$;

-- 3. Миграция существующих ALLOWED_EMAILS из env в БД.
--    ВАЖНО: нужно вставить вручную, заменив email-ы на свои.
--    Раскомментируйте и выполните ОДИН раз после создания таблицы:
--
-- insert into allowed_emails (email, note) values
--   ('you@gmail.com', 'migrated from env'),
--   ('tester1@gmail.com', 'migrated from env'),
--   ('tester2@gmail.com', 'migrated from env')
-- on conflict (email) do nothing;
