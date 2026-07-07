import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchBitunixHistoryPositions } from "@/lib/exchanges/bitunix";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    // Список торгуемых символов задаём через env (BITUNIX_SYMBOLS=BTCUSDT,ETHUSDT),
    // т.к. get_history_positions на многих аккаунтах требует symbol в запросе.
    // Если у тебя API отдаёт все символы разом без фильтра — оставь
    // BITUNIX_SYMBOLS пустым, тогда запрос уйдёт без symbol.
    const symbolsEnv = process.env.BITUNIX_SYMBOLS?.trim();
    const symbols = symbolsEnv ? symbolsEnv.split(",").map((s) => s.trim()) : [undefined];

    let totalUpserted = 0;

    for (const symbol of symbols) {
      let skip = 0;
      const limit = 100;

      for (let page = 0; page < 20; page++) {
        const trades = await fetchBitunixHistoryPositions({ symbol, skip, limit });
        if (trades.length === 0) break;

        const { error } = await supabase
          .from("trades")
          .upsert(trades, { onConflict: "exchange,external_id" });
        if (error) throw error;

        totalUpserted += trades.length;
        if (trades.length < limit) break;
        skip += limit;
      }
    }

    return NextResponse.json({ ok: true, upserted: totalUpserted });
  } catch (err) {
    console.error("Bitunix sync error", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
