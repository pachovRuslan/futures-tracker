-- ============================================================
-- Миграция 4: добавление новых бирж (Binance, Bitget, BingX, MEXC)
-- + колонка passphrase_encrypted для бирж с ключ+secret+passphrase
-- ============================================================

-- 1. Расширяем CHECK constraint на trades: добавляем новые биржи.
--    'manual' остаётся — это ручные сделки, не настоящая биржа.
alter table trades drop constraint if exists trades_exchange_check;
alter table trades add constraint trades_exchange_check
  check (exchange in ('bybit', 'bitunix', 'binance', 'bitget', 'bingx', 'mexc', 'manual'));

-- 2. То же самое на exchange_connections — туда 'manual' не входит,
--    ручные сделки не имеют API-ключей.
alter table exchange_connections drop constraint if exists exchange_connections_exchange_check;
alter table exchange_connections add constraint exchange_connections_exchange_check
  check (exchange in ('bybit', 'bitunix', 'binance', 'bitget', 'bingx', 'mexc'));

-- 3. Колонка passphrase_encrypted — для Bitget, OKX, KuCoin и других бирж,
--    которые требуют третье поле при создании API-ключа. Для бирж без
--    passphrase (Bybit, Binance, MEXC, BingX) колонка остаётся NULL.
alter table exchange_connections
  add column if not exists passphrase_encrypted text;

-- Комментарий в БД, чтобы будущие разработчики понимали назначение колонки.
comment on column exchange_connections.passphrase_encrypted is
  'Зашифрованная passphrase биржи (Bitget, OKX, KuCoin). NULL для бирж без passphrase.';

-- 4. Проверка (необязательно — для self-audit после миграции):
--    должно показать список всех бирж, разрешённых в CHECK.
-- select con.conname, pg_get_constraintdef(con.oid)
-- from pg_constraint con
-- join pg_class rel on rel.oid = con.conrelid
-- where rel.relname in ('trades', 'exchange_connections')
--   and con.contype = 'c';
