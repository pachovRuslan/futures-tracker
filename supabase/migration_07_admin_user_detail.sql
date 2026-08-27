-- ============================================================
-- Миграция 07: RPC-функции для админ-детали по пользователю
-- ============================================================
-- Эти функции используются в /api/admin/users/[id] для получения
-- детальной статистики конкретного пользователя.
-- security_definer — обходит RLS, чтобы читать auth.users и чужие trades.
-- ============================================================

-- 1. Получить профиль пользователя по id (email, created_at, last_sign_in_at)
-- auth.users нельзя читать через обычный select — только через service_role
-- или security_definer функцию.
create or replace function get_user_by_id(p_user_id uuid)
returns table (
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql security definer as $$
  select email, created_at, last_sign_in_at
  from auth.users
  where id = p_user_id;
$$;

-- 2. Агрегаты по сделкам пользователя
--    - total_trades: всего сделок
--    - total_net_pnl: суммарный PnL (realized_pnl - fee + funding)
--    - profitable / losing: количество прибыльных / убыточных
--    - by_exchange: JSON с разбивкой по биржам
--    - by_side: JSON с разбивкой long/short
create or replace function get_user_trades_stats(p_user_id uuid)
returns json
language sql security definer as $$
  select json_build_object(
    'total_trades', count(*),
    'total_net_pnl', coalesce(sum(realized_pnl - fee + funding), 0),
    'profitable', count(*) filter (where realized_pnl - fee + funding > 0),
    'losing', count(*) filter (where realized_pnl - fee + funding <= 0),
    'by_exchange', (
      select json_object_agg(exchange, json_build_object(
        'count', cnt,
        'pnl', pnl
      ))
      from (
        select
          exchange,
          count(*) as cnt,
          coalesce(sum(realized_pnl - fee + funding), 0) as pnl
        from trades
        where user_id = p_user_id
        group by exchange
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
  from trades
  where user_id = p_user_id;
$$;

-- 3. Monthly summary для конкретного пользователя
--    Аналог вьюхи monthly_summary, но отфильтровано по user_id.
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
  select
    to_char(date_trunc('month', closed_at), 'YYYY-MM') as month,
    sum(realized_pnl) as total_pnl,
    sum(fee) as total_fee,
    sum(funding) as total_funding,
    sum(realized_pnl - fee + funding) as net_pnl,
    count(*) as trade_count,
    round(
      100.0 * count(*) filter (where realized_pnl > 0) / nullif(count(*), 0),
      1
    ) as win_rate
  from trades
  where user_id = p_user_id
  group by date_trunc('month', closed_at)
  order by date_trunc('month', closed_at) desc;
$$;

-- Проверка (замените UUID на реальный):
-- select * from get_user_by_id('00000000-0000-0000-0000-000000000000');
-- select * from get_user_trades_stats('00000000-0000-0000-0000-000000000000');
-- select * from get_user_monthly_summary('00000000-0000-0000-0000-000000000000');
