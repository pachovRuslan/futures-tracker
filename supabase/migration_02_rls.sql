-- ============================================================
-- Миграция 2: user_id + Row Level Security
-- Выполнять ПОСЛЕ того, как хотя бы раз залогинился через Google
-- (нужен твой auth.users.id) — иначе backfill будет некого назначать.
-- ============================================================

-- 1. Добавляем колонку user_id (пока nullable — заполним следующим шагом)
alter table trades add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Backfill: привязываем все уже существующие сделки к твоему аккаунту.
--    ЗАМЕНИ email на тот, которым логинишься через Google!
update trades
set user_id = (select id from auth.users where email = 'xyupizdaebaca@gmail.com')
where user_id is null;

-- 3. Проверка перед тем, как сделать колонку обязательной —
--    если тут вернётся 0, значит backfill не сработал (неверный email
--    или ещё не логинился) — тогда НЕ выполняй шаг 4, разберись сначала.
select count(*) as trades_without_user from trades where user_id is null;

-- 4. Делаем user_id обязательным (выполнять только если шаг 3 вернул 0)
alter table trades alter column user_id set not null;

-- 5. external_id должен быть уникален в рамках пользователя, а не глобально
alter table trades drop constraint if exists trades_exchange_external_id_key;
alter table trades add constraint trades_user_exchange_external_id_key
  unique (user_id, exchange, external_id);

-- 6. Включаем Row Level Security
alter table trades enable row level security;

drop policy if exists "Users can view own trades" on trades;
drop policy if exists "Users can insert own trades" on trades;
drop policy if exists "Users can update own trades" on trades;
drop policy if exists "Users can delete own trades" on trades;

create policy "Users can view own trades" on trades
  for select using (auth.uid() = user_id);

create policy "Users can insert own trades" on trades
  for insert with check (auth.uid() = user_id);

create policy "Users can update own trades" on trades
  for update using (auth.uid() = user_id);

create policy "Users can delete own trades" on trades
  for delete using (auth.uid() = user_id);

-- 7. monthly_summary должна фильтроваться RLS-ом того, кто её запрашивает,
--    а не того, кто её создал (security_invoker) — иначе вьюха будет
--    показывать сводку по ВСЕМ пользователям сразу, игнорируя RLS.
drop view if exists monthly_summary;
create view monthly_summary with (security_invoker = true) as
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
group by date_trunc('month', closed_at)
order by date_trunc('month', closed_at) desc;
