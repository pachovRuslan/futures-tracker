import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Серверная проверка премиум-статуса для API-роутов.
 *
 * Дублирует SQL-функцию ft_is_effective_premium (миграция 10):
 *   a) user_entitlements.is_premium = true и подписка не истекла
 *      (expires_at NULL = бессрочно);
 *   b) user_entitlements.is_allowlisted = true;
 *   c) email юзера есть в allowed_emails (web-allowlist — у юзеров
 *      сайта строка в user_entitlements часто не создавалась).
 *
 * Используется для гейта мобильных запросов (Bearer JWT) к премиум-фичам
 * (/api/connections POST, /api/sync/[exchange]). Cookie-запросы сайта
 * НЕ гейтятся: сайт закрыт allowlist-middleware'ом целиком, его юзеры
 * и так имеют полный доступ.
 */

export const PREMIUM_REQUIRED_CODE = "PREMIUM_REQUIRED";

export interface PremiumCheckResult {
  premium: boolean;
}

/**
 * Запрос пришёл от мобильного приложения (Bearer-JWT), а не от
 * cookie-сессии сайта. Именно мобильная поверхность — freemium.
 */
export function isMobileRequest(req: NextRequest): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

/**
 * Ответ 402 для FREE-юзера, дёрнувшего премиум-фичу с мобилки.
 * Мобилка распознаёт код PREMIUM_REQUIRED и открывает пейволл.
 */
export function premiumRequiredResponse(): Response {
  return Response.json(
    {
      error: PREMIUM_REQUIRED_CODE,
      code: PREMIUM_REQUIRED_CODE,
      message:
        "Подключения бирж и авто-синк доступны по подписке Premium. Оформите её в приложении.",
    },
    { status: 402 },
  );
}

/**
 * Эффективный премиум-статус юзера.
 *
 * Клиент может быть любым: user-scoped (RLS пустит читать только свою
 * строку user_entitlements и allowlist — обе политики это разрешают)
 * или service-role.
 */
export async function isPremiumUser(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("is_premium, is_allowlisted, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[entitlements] user_entitlements read error:", error.message);
  }

  if (data) {
    const active =
      data.is_premium &&
      (!data.expires_at || new Date(data.expires_at).getTime() > Date.now());
    if (active || data.is_allowlisted) return true;
  }

  // Web-allowlist: юзеры сайта могли никогда не получить строку в
  // user_entitlements — проверяем email напрямую.
  if (email) {
    const { data: allowed } = await supabase
      .from("allowed_emails")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (allowed) return true;
  }

  return false;
}
