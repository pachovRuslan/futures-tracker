import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Серверная проверка премиум-статуса для API-роутов.
 *
 * Зеркалит SQL-функцию ft_is_effective_premium после миграции 13
 * (разделение allow/premium):
 *   премиум = user_entitlements.is_premium = true И подписка не истекла
 *   (expires_at NULL = бессрочно).
 *
 * Allowlist (allowed_emails / is_allowlisted) премиумом больше НЕ
 * считается — он управляет только входом на сайт. Приглашённые юзеры
 * освобождены от FREE-лимита 50 сделок отдельной веткой в триггере
 * enforce_free_trade_limit (миграция 13): лимит и премиум-гейты
 * касаются только открытых регистраций из приложения.
 *
 * Используется для гейта мобильных запросов (Bearer JWT) к премиум-фичам
 * (/api/connections POST, /api/sync/[exchange]). Cookie-запросы сайта
 * НЕ гейтятся: сайт закрыт allowlist-middleware'ом целиком, его юзеры
 * и так имеют полный доступ.
 */

export const PREMIUM_REQUIRED_CODE = "PREMIUM_REQUIRED";

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
 * строку user_entitlements) или service-role.
 *
 * Премиум = только подписка/ручная выдача (is_premium, не истёк).
 * Членство в allowed_emails статус НЕ поднимает (миграция 13).
 */
export async function isPremiumUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("is_premium, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[entitlements] user_entitlements read error:", error.message);
  }

  if (data) {
    return (
      data.is_premium &&
      (!data.expires_at || new Date(data.expires_at).getTime() > Date.now())
    );
  }

  return false;
}
