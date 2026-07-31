import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { authenticateSyncRequest } from "@/lib/auth";
import { getSyncTargets, syncAllUsers, summarizeResults } from "@/lib/sync";
import { REGISTRY, isValidExchange } from "@/lib/exchanges";

export const maxDuration = 60;

/**
 * Динамический sync-роут: /api/sync/[exchange]
 *
 * Заменяет старые статические /api/sync/bybit и /api/sync/bitunix.
 * При добавлении новой биржи не надо создавать новый route handler —
 * достаточно зарегистрировать адаптер в lib/exchanges/index.ts.
 *
 * Авторизация:
 *   - Vercel cron (Bearer $CRON_SECRET) — синкаем ВСЕХ пользователей
 *   - Залогиненный пользователь — синкаем ТОЛЬКО его подключение
 *
 * Параметры:
 *   - days: на сколько дней назад копать (по умолчанию 365). Только для Bybit
 *     и других бирж с windowed API — остальные адаптеры сами решают, как
 *     интерпретировать sinceMs/untilMs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ exchange: string }> }
) {
  try {
    const { exchange } = await params;

    // Валидация: биржа должна быть в реестре.
    if (!isValidExchange(exchange)) {
      return NextResponse.json(
        { ok: false, error: `Неизвестная биржа: ${exchange}` },
        { status: 404 }
      );
    }

    const adapter = REGISTRY[exchange];

    // Авторизация: cron (синк всех) или user (только своё подключение).
    const auth = await authenticateSyncRequest(req);
    if ("error" in auth) return auth.error;

    // Список подключений, которые нужно просинкать в этом запуске.
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

    // ?days=N — на сколько дней назад копать (для Bybit и других с windowed API).
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 365;
    const now = Date.now();
    const sinceMs = now - days * 24 * 60 * 60 * 1000;

    // Цикл по всем целям. Ошибки изолированы: если у одного пользователя
    // ключ стал невалидным, остальные всё равно просинкаются.
    const results = await syncAllUsers(targets, async ({ userId, credentials }) => {
      const supabase = getSupabaseServerClient();
      let userUpserted = 0;
      let cursor: string | undefined;

      // Адаптер сам отвечает за пагинацию — вызываем его в цикле, пока
      // nextCursor !== null. Большинство адаптеров возвращает nextCursor=null
      // сразу (проходят все страницы внутри одного вызова), но Bybit
      // потенциально может вернуть курсор для продолжения.
      let pageTradesCount = 0;
      let firstPageSample: unknown = null;
      for (let page = 0; page < 100; page++) {
        const { trades, nextCursor } = await adapter.fetchClosedTrades(credentials, {
          sinceMs,
          untilMs: now,
          cursor,
        });

        // Debug: сохраняем sample первой страницы для диагностики
        if (page === 0 && trades.length > 0 && firstPageSample === null) {
          firstPageSample = trades[0];
        }
        pageTradesCount += trades.length;

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
      // Debug-лог в ответ API — покажет, сколько сделок нашёл адаптер
      // и пример структуры первой сделки.
      console.log(`[sync/${exchange}] user=${userId} found=${pageTradesCount} upserted=${userUpserted}`);
      if (pageTradesCount === 0) {
        console.log(`[sync/${exchange}] adapter returned 0 trades — check API response structure`);
      }
      return userUpserted;
    });

    const summary = summarizeResults(results);

    // Для ручного запуска с дашборда: показываем человекочитаемую ошибку,
    // если у текущего пользователя синк упал.
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
      // Debug-инфо для диагностики — показывает, сколько сделок нашёл
      // адаптер vs сколько записано в БД. Если found > 0 но upserted = 0 —
      // проблема в upsert. Если found = 0 — проблема в адаптере/ответе API.
      debug: {
        targetsCount: targets.length,
        results: results.map((r) => ({
          userId: r.userId.slice(0, 8),
          upserted: r.upserted,
          error: r.error?.slice(0, 200),
        })),
      },
    });
  } catch (err) {
    // Логируем только сообщение, без полного объекта — в err может быть
    // URL запроса с подписью, которое не должно попадать в логи Vercel.
    console.error(`Sync error:`, err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
