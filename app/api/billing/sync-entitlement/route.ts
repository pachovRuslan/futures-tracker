import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * POST /api/billing/sync-entitlement — сверка подписки с RevenueCat.
 *
 * Вызывается мобильным приложением (Bearer JWT):
 *   - после успешной покупки / восстановления покупок;
 *   - при каждом запуске с залогиненным юзером (подтягивает продления
 *     и отмены без webhook'ов).
 *
 * Схема: сервер сам спрашивает RevenueCat v1 API о подписке app_user_id
 * (= supabase user id, мобилка делает Purchases.logIn(userId)), поэтому
 * клиент не может «нарисовать» себе премиум — равно как и присланный
 * receipt не нужен.
 *
 * Правила записи в user_entitlements:
 *   - активная подписка → is_premium = true, expires_at, granted_by =
 *     'revenuecat:<store>' (allowlist-колонки не трогаем);
 *   - подписки нет → понижение ТОЛЬКО если премиум был выдан покупкой
 *     (granted_by LIKE 'revenuecat:%'). Ручные выдачи админа и allowlist
 *     сверка трогать не должна.
 *
 * Env:
 *   REVENUECAT_SECRET_API_KEY — секретный ключ v1 (sk_...) из
 *     RevenueCat Dashboard → Project Settings → API Keys.
 *   REVENUECAT_ENTITLEMENT_ID — идентификатор entitlement (по умолчанию
 *     «premium»).
 */

export const maxDuration = 30;

const RC_V1_URL = "https://api.revenuecat.com/v1";

interface RcEntitlementInfo {
  expires_date: string | null;
  product_identifier: string;
}

interface RcSubscriptionInfo {
  store?: string;
}

interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RcEntitlementInfo>;
    subscriptions?: Record<string, RcSubscriptionInfo>;
  };
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "REVENUECAT_NOT_CONFIGURED", message: "REVENUECAT_SECRET_API_KEY не задан на сервере" },
        { status: 503 },
      );
    }
    const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID || "premium";

    const supabase = await createApiSupabaseClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // ─── 1. Спрашиваем RevenueCat о подписке этого app_user_id ───────────
    let rc: RcSubscriberResponse | null = null;
    try {
      const res = await fetch(`${RC_V1_URL}/subscribers/${user.id}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      // v1 GET /subscribers создаёт подписчика, если его нет, и почти
      // всегда отвечает 200. Любой сбой сети/статус — «подписки нет».
      if (res.ok) {
        rc = (await res.json()) as RcSubscriberResponse;
      }
    } catch (err) {
      console.error(
        "[sync-entitlement] RevenueCat fetch error:",
        err instanceof Error ? err.message : String(err),
      );
    }

    const entitlement = rc?.subscriber?.entitlements?.[entitlementId];
    const isActive = Boolean(
      entitlement &&
        (!entitlement.expires_date ||
          new Date(entitlement.expires_date).getTime() > Date.now()),
    );
    const expiresAt = isActive && entitlement?.expires_date
      ? entitlement.expires_date
      : null;

    const store =
      entitlement?.product_identifier != null
        ? rc?.subscriber?.subscriptions?.[entitlement.product_identifier]?.store
        : undefined;

    // ─── 2. Сверяем с текущей строкой user_entitlements ──────────────────
    const svc = getSupabaseServerClient();
    const { data: current, error: readError } = await svc
      .from("user_entitlements")
      .select("is_premium, is_allowlisted, expires_at, granted_by")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    const rcOwned = (current?.granted_by ?? "").startsWith("revenuecat");

    if (isActive) {
      const { error: upsertError } = await svc.from("user_entitlements").upsert(
        {
          user_id: user.id,
          email: user.email ?? null,
          is_premium: true,
          expires_at: expiresAt,
          granted_by: `revenuecat:${store ?? "unknown"}`,
          granted_at: new Date().toISOString(),
          note: "Подписка оформлена в приложении (RevenueCat)",
        },
        { onConflict: "user_id" },
      );
      // upsert обновляет только переданные колонки — is_allowlisted
      // существующей строки сохраняется.
      if (upsertError) throw upsertError;

      return NextResponse.json({
        premium: true,
        expiresAt,
        source: store ?? null,
      });
    }

    // Подписки нет. Понижаем только «покупной» премиум: ручные выдачи
    // (granted_by от админа) и allowlist остаются как есть.
    if (rcOwned && current?.is_premium) {
      const { error: updateError } = await svc
        .from("user_entitlements")
        .update({
          is_premium: false,
          note: "Подписка истекла или отменена (RevenueCat)",
        })
        .eq("user_id", user.id);
      if (updateError) throw updateError;
    }

    // Текущий статус без RC: allowlisted-юзер или ручная выдача.
    const stillPremium = Boolean(
      current &&
        (current.is_allowlisted ||
          (current.is_premium &&
            (!current.expires_at ||
              new Date(current.expires_at).getTime() > Date.now()))),
    );

    return NextResponse.json({
      premium: stillPremium,
      expiresAt: current?.expires_at ?? null,
      source: rcOwned ? "revenuecat:expired" : null,
    });
  } catch (err) {
    console.error(
      "sync-entitlement error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
