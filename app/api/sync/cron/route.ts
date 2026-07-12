import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { authenticateSyncRequest } from "@/lib/auth";
import { getSyncTargets, syncAllUsers, summarizeResults } from "@/lib/sync";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

export const maxDuration = 60;

/**
 * Общий cron-роут для Vercel Hobby (лимит 2 cron-задач).
 *
 * Одна задача /api/sync/cron в vercel.json обходит ВСЕ биржи последовательно,
 * вместо 6 отдельных /api/sync/{bybit,bitunix,binance,...}.
 *
 * Авторизация: только Vercel cron (Bearer $CRON_SECRET).
 * Обычный юзер не должен дёргать этот роут — для ручного запуска есть
 * /api/sync/[exchange] с отдельной кнопкой на дашборде.
 *
 * Последовательный обход (не параллельный) — чтобы:
 *   1. Не упереться в 60-секундный лимит Vercel Hobby
 *   2. Не перегружать биржи параллельными запросами от одного IP
 *   3. Иметь предсказуемое время выполнения
 *
 * Возвращает сводку по всем биржам — для логов Vercel и отладки.
 */
export async function GET(req: NextRequest) {
  try {
    // Авторизация: только cron. Если юзер вызовет — получит 401.
    const auth = await authenticateSyncRequest(req);
    if ("error" in auth) return auth.error;
    // Разрешаем только cron-режим — ручной запуск через /api/sync/[exchange]
    if (auth.mode !== "cron") {
      return NextResponse.json(
        { error: "Этот роут только для cron. Используйте /api/sync/[exchange] для ручного запуска." },
        { status: 403 }
      );
    }

    const now = Date.now();
    const sinceMs = now - 365 * 24 * 60 * 60 * 1000; // год назад
    const allResults: { exchange: string; processed: number; succeeded: number; failed: number; upserted: number; errors: { userId: string; error: string }[] }[] = [];

    // Последовательно обходим все биржи.
    for (const exchange of EXCHANGES) {
      try {
        const targets = await getSyncTargets(exchange, auth);
        if (targets.length === 0) {
          allResults.push({
            exchange,
            processed: 0,
            succeeded: 0,
            failed: 0,
            upserted: 0,
            errors: [],
          });
          continue;
        }

        const results = await syncAllUsers(targets, async ({ userId, credentials }) => {
          const supabase = getSupabaseServerClient();
          let userUpserted = 0;
          let cursor: string | undefined;

          for (let page = 0; page < 100; page++) {
            const { trades, nextCursor } = await REGISTRY[exchange].fetchClosedTrades(credentials, {
              sinceMs,
              untilMs: now,
              cursor,
            });

            if (trades.length > 0) {
              const rows = trades.map((t) => ({ ...t, user_id: userId }));
              const { error } = await supabase
                .from("trades")
                .upsert(rows, { onConflict: "user_id,exchange,external_id" });
              if (error) throw error;
              userUpserted += trades.length;
            }

            if (!nextCursor) break;
            cursor = nextCursor;
          }
          return userUpserted;
        });

        const summary = summarizeResults(results);
        allResults.push({
          exchange,
          ...summary,
        });
      } catch (err) {
        // Если вся биржа упала — логируем, но идём к следующей.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron] exchange=${exchange} failed: ${msg}`);
        allResults.push({
          exchange,
          processed: 0,
          succeeded: 0,
          failed: 1,
          upserted: 0,
          errors: [{ userId: "-", error: msg }],
        });
      }
    }

    // Сводка для логов Vercel
    const totalUpserted = allResults.reduce((acc, r) => acc + r.upserted, 0);
    const totalFailed = allResults.reduce((acc, r) => acc + r.failed, 0);
    console.log(
      `[cron] done: ${totalUpserted} upserted, ${totalFailed} failed across ${EXCHANGES.length} exchanges`
    );

    return NextResponse.json({
      ok: totalFailed === 0,
      mode: "cron",
      totalUpserted,
      totalFailed,
      perExchange: allResults,
    });
  } catch (err) {
    console.error("Cron sync error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
