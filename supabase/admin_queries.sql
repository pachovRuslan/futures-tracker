select
  u.email,
  u.created_at           as user_registered_at,
  u.last_sign_in_at,
  count(ec.id) filter (where ec.exchange = 'bybit')   as bybit,
  count(ec.id) filter (where ec.exchange = 'bitunix') as bitunix,
  count(ec.id) filter (where ec.exchange = 'binance') as binance,
  count(ec.id) filter (where ec.exchange = 'bitget')  as bitget,
  count(ec.id) filter (where ec.exchange = 'bingx')   as bingx,
  count(ec.id) filter (where ec.exchange = 'mexc')    as mexc,
  count(ec.id)                                          as total_connections,
  max(ec.created_at)                                   as last_connection_at,
  count(t.id)                                          as trades_count,
  max(t.closed_at)                                     as last_trade_at
from auth.users u
left join exchange_connections ec on ec.user_id = u.id
left join trades t on t.user_id = u.id
group by u.email, u.created_at, u.last_sign_in_at
order by u.created_at desc;
