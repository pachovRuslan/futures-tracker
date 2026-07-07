import { createClient } from "@supabase/supabase-js";

// Используем service_role ключ — приложение single-user, все запросы идут
// через собственные API-роуты, поэтому RLS можно не поднимать.
// НИКОГДА не импортировать этот файл в клиентские компоненты.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы в переменных окружения"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
