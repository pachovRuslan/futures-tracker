import { NextRequest, NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/auth";
import { getSyncTargets, syncAllUsers, syncUserExchange, summarizeResults } from "@/lib/sync";
import { EXCHANGES, REGISTRY } from "@/lib/exchanges";

export const maxDuration = 60;

/**
 * Общий cron-роут для Vercel Hobby (лимит 2 cron-задач).
 * Обходит ВСЕ биржи последовательно.
 *
 * Авторизация: только Vercel cron (Bearer $CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSyncRequest(req);
    if ("error" in auth) return auth.error;
    if (auth.mode !== "cron") {
      return NextResponse.json(
        { error: "Этот роут только для cron. Используйте /api/sync/[exchange] для ручного запуска." },
        { status: 403 }
      );
    }

    const now = Date.now();
    const sinceMs = now - 365 * 24 * 60 * 60 * 1000;
    const allResults: { exchange: string; processed: number; succeeded: number; failed: number; upserted: number; errors: { userId: string; error: string }[] }[] = [];

    for (const exchange of EXCHANGES) {
      try {
        const targets = await getSyncTargets(exchange, auth);
        if (targets.length === 0) {
          allResults.push({ exchange, processed: 0, succeeded: 0, failed: 0, upserted: 0, errors: [] });
          continue;
        }

        // syncUserExchange — общий цикл пагинации (вынесен в lib/sync.ts)
        const results = await syncAllUsers(targets, async ({ userId, credentials }) => {
          return syncUserExchange(REGISTRY[exchange], credentials, userId, sinceMs, now);
        });

        allResults.push({ exchange, ...summarizeResults(results) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron] exchange=${exchange} failed: ${msg}`);
        allResults.push({ exchange, processed: 0, succeeded: 0, failed: 1, upserted: 0, errors: [{ userId: "-", error: msg }] });
      }
    }

    const totalUpserted = allResults.reduce((acc, r) => acc + r.upserted, 0);
    const totalFailed = allResults.reduce((acc, r) => acc + r.failed, 0);
    console.log(`[cron] done: ${totalUpserted} upserted, ${totalFailed} failed across ${EXCHANGES.length} exchanges`);

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
