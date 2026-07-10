import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchBitunixHistoryPositions } from "@/lib/exchanges/bitunix";
import { authenticateSyncRequest } from "@/lib/auth";
import { getSyncTargets, syncAllUsers, summarizeResults } from "@/lib/sync";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    // Авторизация: Vercel cron (Bearer CRON_SECRET) — синкаем всех,
    // либо залогиненный пользователь — синкаем только его подключение.
    const auth = await authenticateSyncRequest(req);
    if ("error" in auth) return auth.error;

    // Список подключений к Bitunix, которые нужно просинкать в этом запуске.
    const targets = await getSyncTargets("bitunix", auth);
    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        upserted: 0,
        message:
          auth.mode === "user"
            ? "Bitunix не подключён — добавь ключ на странице 'Подключения' перед синком"
            : "Нет подключений к Bitunix ни у одного пользователя",
      });
    }

    // Список торгуемых символов задаём через env (BITUNIX_SYMBOLS=BTCUSDT,ETHUSDT),
    // т.к. get_history_positions на многих аккаунтах требует symbol в запросе.
    // Если у тебя API отдаёт все символы разом без фильтра — оставь
    // BITUNIX_SYMBOLS пустым, тогда запрос уйдёт без symbol.
    //
    // NOTE: список символов пока общий для всех пользователей. Если у разных
    // юзеров разные торгуемые пары — это шаг 5 дорожной карты (per-user symbols).
    const symbolsEnv = process.env.BITUNIX_SYMBOLS?.trim();
    const symbols = symbolsEnv ? symbolsEnv.split(",").map((s) => s.trim()) : [undefined];

    // Цикл по всем целям. Ошибки изолированы: если у одного пользователя
    // ключ стал невалидным, остальные всё равно просинкаются.
    const results = await syncAllUsers(targets, async ({ userId, credentials }) => {
      const supabase = getSupabaseServerClient();
      let userUpserted = 0;

      for (const symbol of symbols) {
        let skip = 0;
        const limit = 100;

        for (let page = 0; page < 20; page++) {
          const trades = await fetchBitunixHistoryPositions(credentials, { symbol, skip, limit });
          if (trades.length === 0) break;

          const rows = trades.map((t) => ({ ...t, user_id: userId }));
          const { error } = await supabase
            .from("trades")
            .upsert(rows, { onConflict: "user_id,exchange,external_id" });
          if (error) throw error;

          userUpserted += trades.length;
          if (trades.length < limit) break;
          skip += limit;
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
    console.error("Bitunix sync error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
