import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { ManualTradeInput } from "@/lib/types";

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

// Добавление сделки вручную (например, старые сделки, которые не подтянула биржа,
// или сделки без API — просто заметки о торговле)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const body = (await req.json()) as ManualTradeInput;

    if (!body.symbol || !body.side || !body.closed_at) {
      return NextResponse.json(
        { error: "symbol, side и closed_at обязательны" },
        { status: 400 }
      );
    }

    const row = {
      exchange: "manual" as const,
      external_id: crypto.randomUUID(),
      symbol: body.symbol,
      side: body.side,
      qty: body.qty,
      entry_price: body.entry_price,
      close_price: body.close_price,
      realized_pnl: body.realized_pnl ?? 0,
      fee: body.fee ?? 0,
      funding: body.funding ?? 0,
      opened_at: body.opened_at,
      closed_at: body.closed_at,
      notes: body.notes ?? null,
      raw: null,
    };

    const { data, error } = await supabase.from("trades").insert(row).select().single();
    if (error) throw error;

    return NextResponse.json({ trade: data });
  } catch (err) {
    console.error("Manual trade create error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
