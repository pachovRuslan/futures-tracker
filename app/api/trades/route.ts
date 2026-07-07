import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const exchange = searchParams.get("exchange");
    const symbol = searchParams.get("symbol");
    const limit = Number(searchParams.get("limit") ?? 200);

    let query = supabase
      .from("trades")
      .select("*")
      .order("closed_at", { ascending: false })
      .limit(limit);

    if (exchange) query = query.eq("exchange", exchange);
    if (symbol) query = query.eq("symbol", symbol);

    const [{ data: trades, error: tradesError }, { data: summary, error: summaryError }] =
      await Promise.all([query, supabase.from("monthly_summary").select("*")]);

    if (tradesError) throw tradesError;
    if (summaryError) throw summaryError;

    return NextResponse.json({ trades, summary });
  } catch (err) {
    console.error("Trades fetch error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
