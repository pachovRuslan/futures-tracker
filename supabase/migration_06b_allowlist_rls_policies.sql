-- ============================================================
-- Миграция 06b: добавляем INSERT/UPDATE/DELETE политики на allowed_emails
-- Выполнять, если миграция 06 уже применена и при добавлении email
-- через админку возникает ошибка:
--   "new row violates row-level security policy for table allowed_emails"
-- ============================================================

-- В миграции 06 была только SELECT-политика. INSERT/UPDATE/DELETE забыли.
-- Сейчас добавляем.

drop policy if exists "Authenticated can insert allowlist" on allowed_emails;
create policy "Authenticated can insert allowlist" on allowed_emails
  for insert with check (auth.uid() is not null);

drop policy if exists "Authenticated can update allowlist" on allowed_emails;
create policy "Authenticated can update allowlist" on allowed_emails
  for update using (auth.uid() is not null);

drop policy if exists "Authenticated can delete allowlist" on allowed_emails;
create policy "Authenticated can delete allowlist" on allowed_emails
  for delete using (auth.uid() is not null);

-- Проверка: должно показать 4 политики (select + insert + update + delete)
-- select policyname, cmd from pg_policies where tablename = 'allowed_emails';
