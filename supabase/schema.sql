create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  exchange text not null check (exchange in ('bybit', 'bitunix')),
  external_id text not null,
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  qty numeric,
  entry_price numeric,
  close_price numeric,
  realized_pnl numeric not null default 0,
  fee numeric not null default 0,
  funding numeric not null default 0,
  opened_at timestamptz,
  closed_at timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (exchange, external_id)
);

create index if not exists trades_closed_at_idx on trades (closed_at desc);
create index if not exists trades_exchange_idx on trades (exchange);

-- Готовая вьюха для месячной сводки, чтобы не считать агрегаты на клиенте
create or replace view monthly_summary as
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
