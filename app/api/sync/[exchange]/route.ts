import { NextRequest, NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/auth";
import { getSyncTargets, syncAllUsers, syncUserExchange, summarizeResults } from "@/lib/sync";
import { REGISTRY, isValidExchange } from "@/lib/exchanges";

export const maxDuration = 60;

/**
 * Динамический sync-роут: /api/sync/[exchange]
 *
 * Авторизация:
 *   - Vercel cron (Bearer $CRON_SECRET) — синкаем ВСЕХ пользователей
 *   - Залогиненный пользователь — синкаем ТОЛЬКО его подключение
 *
 * Параметры:
 *   - days: на сколько дней назад копать (по умолчанию 365)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ exchange: string }> }
) {
  try {
    const { exchange } = await params;

    if (!isValidExchange(exchange)) {
      return NextResponse.json(
        { ok: false, error: `Неизвестная биржа: ${exchange}` },
        { status: 404 }
      );
    }

    const adapter = REGISTRY[exchange];

    const auth = await authenticateSyncRequest(req);
    if ("error" in auth) return auth.error;

    const targets = await getSyncTargets(exchange, auth);
    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        upserted: 0,
        message:
          auth.mode === "user"
            ? `${adapter.label} не подключён — добавь ключ на странице 'Подключения' перед синком`
            : `Нет подключений к ${adapter.label} ни у одного пользователя`,
      });
    }

    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 365;
    const now = Date.now();
    const sinceMs = now - days * 24 * 60 * 60 * 1000;

    // syncUserExchange — общий цикл пагинации (вынесен в lib/sync.ts)
    const results = await syncAllUsers(targets, async ({ userId, credentials }) => {
      return syncUserExchange(adapter, credentials, userId, sinceMs, now);
    });

    const summary = summarizeResults(results);

    // Для ручного запуска: показываем ошибку, если у текущего пользователя синк упал
    let userError: string | undefined;
    if (auth.mode === "user") {
      const userResult = results.find((r) => r.userId === auth.userId);
      if (userResult?.error) userError = userResult.error;
    }

    return NextResponse.json({
      ok: summary.failed === 0,
      mode: auth.mode,
      exchange,
      ...summary,
      ...(userError ? { error: userError } : {}),
    });
  } catch (err) {
    console.error(`Sync error:`, err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
