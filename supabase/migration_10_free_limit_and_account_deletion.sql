-- ============================================================
-- Миграция 10: серверный FREE-лимит 50 сделок + удаление аккаунта
-- ============================================================
-- Контекст (аудит мобильного приложения, волна 1):
--
--   1) Лимит «FREE = до 50 сделок» раньше проверялся ТОЛЬКО на
--      клиенте мобилки. Deep link futurestracker://trade/new или
--      прямой POST в Supabase REST (/rest/v1/trades) с валидным JWT
--      обходили его — RLS-политика проверяет лишь user_id. Теперь
--      лимит дублируется BEFORE INSERT-триггером в самой БД.
--
--   2) Для публикации в Google Play / App Store обязателен механизм
--      удаления аккаунта из приложения. RPC delete_my_account()
--      удаляет пользователя из auth.users — данные (trades,
--      user_entitlements, balance_snapshots, exchange_connections)
--      сносятся каскадом: у всех FK уже есть ON DELETE CASCADE.
--      monthly_summary — вьюха, данных не хранит.
--
-- Выполнить в Supabase Dashboard → SQL Editor. Идемпотентно.

-- ─────────────────────────────────────────────────────────────
-- 1. «Эффективный премиум» — единая функция-источник правды
-- ─────────────────────────────────────────────────────────────
-- Премиум = любое из:
--   a) user_entitlements.is_premium = true И подписка не истекла
--      (expires_at IS NULL = бессрочно);
--   b) user_entitlements.is_allowlisted = true — юзер из allowlist
--      сайта: он и так имел полный доступ до freemium-модели;
--   c) email юзера есть в таблице allowed_emails — web-allowlist:
--      строка в user_entitlements у большинства юзеров сайта
--      никогда не создавалась.
--
-- ВАЖНО: без пунктов (b)/(c) триггер сломал бы САЙТ: его
-- пользователи вставляют сделки через cookie-сессию (RLS,
-- auth.uid() установлен), и лимит 50 применялся бы к ним.

create or replace function public.ft_is_effective_premium(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select e.is_premium and (e.expires_at is null or e.expires_at > now())
        from public.user_entitlements e
        where e.user_id = p_user_id
      ),
      false
    )
    or coalesce(
      (
        select e.is_allowlisted
        from public.user_entitlements e
        where e.user_id = p_user_id
      ),
      false
    )
    or exists (
      select 1
      from public.allowed_emails a
      join auth.users u on lower(u.email) = lower(a.email)
      where u.id = p_user_id
    );
$$;

revoke all on function public.ft_is_effective_premium(uuid) from public, anon;
grant execute on function public.ft_is_effective_premium(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Триггер FREE-лимита на public.trades
-- ─────────────────────────────────────────────────────────────

create or replace function public.enforce_free_trade_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Серверный синк бирж (cron + ручной запуск с сайта) пишет через
  -- service_role: auth.uid() = null, лимит его не касается. Синк и
  -- так премиум-фича — для мобильных запросов он гейтится в API
  -- (402 PREMIUM_REQUIRED в /api/sync/[exchange]).
  if auth.uid() is null then
    return new;
  end if;

  if public.ft_is_effective_premium(auth.uid()) then
    return new;
  end if;

  select count(*) into v_count
  from public.trades t
  where t.user_id = auth.uid();

  -- 50 = FREE_TRADE_LIMIT в мобилке (src/shared/config.ts).
  -- Менять значение — синхронно в обоих местах.
  if v_count >= 50 then
    raise exception 'FREE_TRADE_LIMIT_REACHED: бесплатный план позволяет вести до 50 сделок. Оформите Premium в приложении.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_free_trade_limit() from public, anon;
grant execute on function public.enforce_free_trade_limit() to authenticated;

drop trigger if exists trg_trades_free_limit on public.trades;
create trigger trg_trades_free_limit
  before insert on public.trades
  for each row execute function public.enforce_free_trade_limit();

-- ─────────────────────────────────────────────────────────────
-- 3. Удаление аккаунта самим пользователем
--    (Google Play Account Deletion policy / App Review 5.1.1(v))
-- ─────────────────────────────────────────────────────────────

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '42501';
  end if;

  -- Зависимые таблицы снесёт ON DELETE CASCADE от auth.users.
  -- Порядок: сначала публичные данные (через каскад), затем сам юзер.
  delete from auth.users where id = v_uid;

  return jsonb_build_object('ok', true, 'deleted_at', now());
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Самопроверка после выполнения (раскомментировать при желании)
-- ─────────────────────────────────────────────────────────────
-- select
--   exists(select 1 from pg_trigger where tgname = 'trg_trades_free_limit') as trigger_ok,
--   exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--          where n.nspname = 'public' and p.proname in
--            ('ft_is_effective_premium','delete_my_account')) as functions_ok;
