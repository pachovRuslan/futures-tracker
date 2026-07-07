import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchBybitClosedPnl } from "@/lib/exchanges/bybit";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    let cursor: string | undefined;
    let totalUpserted = 0;

    // Bybit отдаёт максимум 100 записей за раз — листаем курсором,
    // пока он не закончится (ограничиваем 20 страницами на один запуск,
    // чтобы не упереться в лимит времени serverless-функции).
    for (let page = 0; page < 20; page++) {
      const { trades, nextCursor } = await fetchBybitClosedPnl({ cursor });

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

    return NextResponse.json({ ok: true, upserted: totalUpserted });
  } catch (err) {
    console.error("Bybit sync error", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
