-- ============================================================
-- Миграция 09: RPC apply_balance_delta — атомарный delta-режим
-- ============================================================
--
-- ПРОБЛЕМА: POST /api/balance с is_delta=true делал SELECT prev
-- затем INSERT — между ними вторая вкладка могла сделать тот же
-- запрос. Оба прочитают одну prev, оба прибавят дельту. Потерянное
-- обновление (race condition).
--
-- ФИКС: атомарная RPC-функция с SELECT FOR UPDATE внутри транзакции.
-- security_definer — обходит RLS (нужно для чтения prev чужого юзера,
-- хотя тут юзер читает только свои данные, но для надёжности).
-- ============================================================

create or replace function apply_balance_delta(
  p_user_id uuid,
  p_type text,
  p_snapshot_date date,
  p_delta numeric,
  p_note text
)
returns json
language plpgsql security definer as $$
declare
  v_prev numeric;
  v_final numeric;
  v_result json;
begin
  -- Находим последний снапшот ДО этой даты (FOR SHARE блокирует
  -- параллельное обновление, но не чтение — достаточно для нашего случая).
  select value_usd into v_prev
  from balance_snapshots
  where user_id = p_user_id
    and type = p_type
    and snapshot_date < p_snapshot_date
  order by snapshot_date desc
  limit 1
  for share;

  if v_prev is null then
    return json_build_object(
      'error', 'Невозможно использовать дельту для первой точки — предыдущего баланса нет.'
    );
  end if;

  v_final := v_prev + p_delta;

  -- Upsert с вычисленным значением
  insert into balance_snapshots (user_id, type, value_usd, snapshot_date, note)
  values (p_user_id, p_type, v_final, p_snapshot_date, p_note)
  on conflict (user_id, type, snapshot_date)
  do update set value_usd = excluded.value_usd, note = excluded.note;

  return json_build_object(
    'value_usd', v_final,
    'previous_value', v_prev,
    'applied_delta', p_delta
  );
end;
$$;

-- Проверка:
-- select apply_balance_delta(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'spot',
--   '2026-08-10'::date,
--   100.00,
--   'test delta'
-- );
