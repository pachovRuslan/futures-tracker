import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchBybitClosedPnl } from "@/lib/exchanges/bybit";
import { authenticateSyncRequest } from "@/lib/auth";
import { getSyncTargets, syncAllUsers, summarizeResults } from "@/lib/sync";

export const maxDuration = 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    // Авторизация: Vercel cron (Bearer CRON_SECRET) — синкаем всех,
    // либо залогиненный пользователь — синкаем только его подключение.
    const auth = await authenticateSyncRequest(req);
    if ("error" in auth) return auth.error;

    // Список подключений к Bybit, которые нужно просинкать в этом запуске.
    const targets = await getSyncTargets("bybit", auth);
    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        upserted: 0,
        message:
          auth.mode === "user"
            ? "Bybit не подключён — добавь ключ на странице 'Подключения' перед синком"
            : "Нет подключений к Bybit ни у одного пользователя",
      });
    }

    // Bybit ограничивает closed-pnl диапазоном endTime-startTime <= 7 дней,
    // а без startTime/endTime отдаёт только последние 24 часа. Поэтому
    // нарезаем весь запрошенный период на 7-дневные окна и проходим их все.
    // ?days=N — на сколько дней назад копать (по умолчанию — год).
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 365;
    const now = Date.now();
    const rangeStart = now - days * 24 * 60 * 60 * 1000;

    // Цикл по всем целям. Ошибки изолированы: если у одного пользователя
    // ключ стал невалидным, остальные всё равно просинкаются.
    const results = await syncAllUsers(targets, async ({ userId, credentials }) => {
      const supabase = getSupabaseServerClient();
      let userUpserted = 0;

      for (let windowEnd = now; windowEnd > rangeStart; windowEnd -= SEVEN_DAYS_MS) {
        const windowStart = Math.max(windowEnd - SEVEN_DAYS_MS, rangeStart);
        let cursor: string | undefined;

        // Пагинация курсором внутри одного 7-дневного окна (на случай, если
        // сделок за неделю окажется больше 100)
        for (let page = 0; page < 10; page++) {
          const { trades, nextCursor } = await fetchBybitClosedPnl(credentials, {
            cursor,
            startTimeMs: windowStart,
            endTimeMs: windowEnd,
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
      ...summary,
      ...(userError ? { error: userError } : {}),
    });
  } catch (err) {
    // Логируем только сообщение, без полного объекта — в err может быть
    // URL запроса с подписью, которое не должно попадать в логи Vercel.
    console.error("Bybit sync error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
