-- ============================================================
-- Миграция 08: защита security_definer функций — проверка admin
-- ============================================================
--
-- ПРОБЛЕМА (RLS-дыра): функции get_users_overview(), get_user_by_id(),
-- get_user_trades_stats(), get_user_monthly_summary() созданы как
-- security_definer и читают auth.users + чужие trades в обход RLS.
-- Но они НЕ проверяют, что вызывающий — админ. Любой залогиненный
-- из allowlist может из браузера через supabase.rpc('get_users_overview')
-- получить все email-ы, user_id, PnL всех пользователей. Data breach.
--
-- ФИКС: таблица admin_emails в БД + проверка внутри каждой функции.
-- Если вызывающий не админ — функция возвращает пустой результат.
--
-- ADMIN_EMAILS из env остаётся для middleware (быстрая проверка
-- на каждом HTTP-запросе). SQL функции не имеют доступа к env,
-- поэтому проверяют через таблицу admin_emails.
-- ============================================================

-- 1. Таблица admin_emails — кто может вызывать admin-функции.
--    Управляется через SQL (в будущем — через /api/admin/admins).
create table if not exists admin_emails (
  email text primary key,
  added_at timestamptz not null default now(),
  note text
);

alter table admin_emails enable row level security;

-- Чтение — любой залогиненный (нужно lib/admin.ts для проверки).
-- Запись — через service_role в API-роутах (пока нет, управляем через SQL).
drop policy if exists "Anyone authenticated can read admin_emails" on admin_emails;
create policy "Anyone authenticated can read admin_emails" on admin_emails
  for select using (auth.uid() is not null);

-- 2. МИГРАЦИЯ ADMIN_EMAILS из env в БД.
--    Замените на ваши админские email-ы. Раскомментируйте и выполните:
--
-- insert into admin_emails (email, note) values
--   ('you@gmail.com', 'migrated from ADMIN_EMAILS env'),
--   ('cofounder@gmail.com', 'migrated from ADMIN_EMAILS env')
-- on conflict (email) do nothing;

-- ============================================================
-- 3. Переписываем security_definer функции с проверкой admin
-- ============================================================

-- get_users_overview() — список всех пользователей со статистикой.
-- Если вызывающий не админ — возвращает пустой результат.
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
  with admin_check as (
    select 1 as ok from admin_emails ae
    where ae.email = (select email from auth.users where id = auth.uid())
  )
  select
    u.email,
    u.id,
    u.created_at,
    u.last_sign_in_at,
    coalesce((select count(*) from exchange_connections ec where ec.user_id = u.id and ec.exchange = 'bybit'), 0),
    coalesce((select count(*) from exchange_connections ec where ec.user_id = u.id and ec.exchange = 'bitunix'), 0),
    coalesce((select count(*) from exchange_connections ec where ec.user_id = u.id and ec.exchange = 'binance'), 0),
    coalesce((select count(*) from exchange_connections ec where ec.user_id = u.id and ec.exchange = 'bitget'), 0),
    coalesce((select count(*) from exchange_connections ec where ec.user_id = u.id and ec.exchange = 'bingx'), 0),
    coalesce((select count(*) from exchange_connections ec where ec.user_id = u.id and ec.exchange = 'mexc'), 0),
    coalesce((select count(*) from exchange_connections ec where ec.user_id = u.id), 0),
    (select max(ec.created_at) from exchange_connections ec where ec.user_id = u.id),
    coalesce((select count(*) from trades t where t.user_id = u.id), 0),
    (select max(t.closed_at) from trades t where t.user_id = u.id),
    coalesce((select sum(t.realized_pnl - t.fee + t.funding) from trades t where t.user_id = u.id), 0)
  from auth.users u, admin_check ac
  where ac.ok = 1
  order by u.created_at desc;
$$;

-- get_user_by_id(p_user_id) — профиль конкретного пользователя.
-- Если вызывающий не админ — возвращает пустой результат.
create or replace function get_user_by_id(p_user_id uuid)
returns table (
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql security definer as $$
  with admin_check as (
    select 1 as ok from admin_emails ae
    where ae.email = (select email from auth.users where id = auth.uid())
  )
  select u.email, u.created_at, u.last_sign_in_at
  from auth.users u, admin_check ac
  where u.id = p_user_id and ac.ok = 1;
$$;

-- get_user_trades_stats(p_user_id) — агрегаты сделок пользователя.
-- Если вызывающий не админ — возвращает JSON с пустыми нулями.
create or replace function get_user_trades_stats(p_user_id uuid)
returns json
language sql security definer as $$
  with admin_check as (
    select 1 as ok from admin_emails ae
    where ae.email = (select email from auth.users where id = auth.uid())
  )
  select case
    when exists (select 1 from admin_check) then
      json_build_object(
        'total_trades', count(*),
        'total_net_pnl', coalesce(sum(realized_pnl - fee + funding), 0),
        'profitable', count(*) filter (where realized_pnl - fee + funding > 0),
        'losing', count(*) filter (where realized_pnl - fee + funding <= 0),
        'by_exchange', (
          select json_object_agg(exchange, json_build_object(
            'count', cnt, 'pnl', pnl
          ))
          from (
            select exchange, count(*) as cnt,
              coalesce(sum(realized_pnl - fee + funding), 0) as pnl
            from trades where user_id = p_user_id group by exchange
          ) e
        ),
        'by_side', json_build_object(
          'long', count(*) filter (where side = 'long'),
          'short', count(*) filter (where side = 'short')
        ),
        'first_trade_at', min(closed_at),
        'last_trade_at', max(closed_at),
        'total_fee', coalesce(sum(fee), 0),
        'total_funding', coalesce(sum(funding), 0)
      )
    else json_build_object(
      'total_trades', 0, 'total_net_pnl', 0, 'profitable', 0, 'losing', 0,
      'by_exchange', '{}'::json, 'by_side', '{"long":0,"short":0}'::json,
      'first_trade_at', null, 'last_trade_at', null,
      'total_fee', 0, 'total_funding', 0
    )
  end
  from trades, admin_check
  where user_id = p_user_id;
$$;

-- get_user_monthly_summary(p_user_id) — PnL по месяцам.
-- Если вызывающий не админ — возвращает пустой результат.
create or replace function get_user_monthly_summary(p_user_id uuid)
returns table (
  month text,
  total_pnl numeric,
  total_fee numeric,
  total_funding numeric,
  net_pnl numeric,
  trade_count bigint,
  win_rate numeric
)
language sql security definer as $$
  with admin_check as (
    select 1 as ok from admin_emails ae
    where ae.email = (select email from auth.users where id = auth.uid())
  )
  select
    to_char(date_trunc('month', t.closed_at), 'YYYY-MM') as month,
    sum(t.realized_pnl) as total_pnl,
    sum(t.fee) as total_fee,
    sum(t.funding) as total_funding,
    sum(t.realized_pnl - t.fee + t.funding) as net_pnl,
    count(*) as trade_count,
    round(
      100.0 * count(*) filter (where t.realized_pnl > 0) / nullif(count(*), 0), 1
    ) as win_rate
  from trades t, admin_check ac
  where t.user_id = p_user_id and ac.ok = 1
  group by date_trunc('month', t.closed_at)
  order by date_trunc('month', t.closed_at) desc;
$$;

-- ============================================================
-- Проверка после миграции:
--
-- 1. Добавьте себя в admin_emails:
--    insert into admin_emails (email) values ('your-email@gmail.com');
--
-- 2. Проверьте, что функция работает для админа:
--    select * from get_users_overview();
--
-- 3. Проверьте, что функция НЕ работает для не-админа:
--    (залогиньтесь как обычный юзер и вызовите через SQL Editor
--    с auth.uid() этого юзера — должно вернуть пустой результат)
-- ============================================================
