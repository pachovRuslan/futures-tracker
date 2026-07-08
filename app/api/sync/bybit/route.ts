import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchBybitClosedPnl } from "@/lib/exchanges/bybit";

export const maxDuration = 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Bybit ограничивает closed-pnl диапазоном endTime-startTime <= 7 дней,
    // а без startTime/endTime отдаёт только последние 24 часа. Поэтому
    // нарезаем весь запрошенный период на 7-дневные окна и проходим их все.
    // ?days=N — на сколько дней назад копать (по умолчанию — год).
    const daysParam = req.nextUrl.searchParams.get("days");
    const days = daysParam ? Number(daysParam) : 365;

    const now = Date.now();
    const rangeStart = now - days * 24 * 60 * 60 * 1000;

    let totalUpserted = 0;

    for (let windowEnd = now; windowEnd > rangeStart; windowEnd -= SEVEN_DAYS_MS) {
      const windowStart = Math.max(windowEnd - SEVEN_DAYS_MS, rangeStart);
      let cursor: string | undefined;

      // Пагинация курсором внутри одного 7-дневного окна (на случай, если
      // сделок за неделю окажется больше 100)
      for (let page = 0; page < 10; page++) {
        const { trades, nextCursor } = await fetchBybitClosedPnl({
          cursor,
          startTimeMs: windowStart,
          endTimeMs: windowEnd,
        });

        if (trades.length > 0) {
          const { error } = await supabase
            .from("trades")
            .upsert(trades, { onConflict: "exchange,external_id" });
          if (error) throw error;
          totalUpserted += trades.length;
        }

        if (!nextCursor) break;
        cursor = nextCursor;
      }
    }

    return NextResponse.json({ ok: true, upserted: totalUpserted });
  } catch (err) {
    console.error("Bybit sync error", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
