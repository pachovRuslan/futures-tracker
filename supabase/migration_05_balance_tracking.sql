-- ============================================================
-- Миграция 5: ручной учёт спот-баланса + цели пользователя
-- ============================================================

-- 1. Таблица снапшотов баланса (и спот, и фьючерс).
--    Спот — только ручной ввод (юзер раз в неделю/месяц заходит и вписывает).
--    Фьючерс — смесь: по умолчанию считается из PnL сделок (auto), но если
--    юзер добавил ручной снапшот на эту дату — он переопределяет auto-расчёт.
create table if not exists balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('spot', 'futures')),
  value_usd numeric not null,
  snapshot_date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, type, snapshot_date)
);

alter table balance_snapshots enable row level security;

drop policy if exists "Users can view own snapshots" on balance_snapshots;
drop policy if exists "Users can insert own snapshots" on balance_snapshots;
drop policy if exists "Users can update own snapshots" on balance_snapshots;
drop policy if exists "Users can delete own snapshots" on balance_snapshots;

create policy "Users can view own snapshots" on balance_snapshots
  for select using (auth.uid() = user_id);
create policy "Users can insert own snapshots" on balance_snapshots
  for insert with check (auth.uid() = user_id);
create policy "Users can update own snapshots" on balance_snapshots
  for update using (auth.uid() = user_id);
create policy "Users can delete own snapshots" on balance_snapshots
  for delete using (auth.uid() = user_id);

create index if not exists balance_snapshots_user_type_date_idx
  on balance_snapshots (user_id, type, snapshot_date desc);

-- 2. Настройки пользователя: цель и стартовый фьючерсный капитал.
--    goal_usd — горизонтальная линия на графике, к которой стремимся.
--    futures_start_usd — стартовая сумма, от которой считаем PnL.
--    Целевой ДАТЫ нет — график уходит в бесконечное будущее.
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_usd numeric,
  futures_start_usd numeric default 0,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

drop policy if exists "Users can view own settings" on user_settings;
drop policy if exists "Users can insert own settings" on user_settings;
drop policy if exists "Users can update own settings" on user_settings;

create policy "Users can view own settings" on user_settings
  for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on user_settings
  for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);
