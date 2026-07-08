import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

// PATCH: заметки можно редактировать у ЛЮБОЙ сделки (bybit/bitunix/manual).
// Остальные поля (цена, qty, pnl и т.д.) можно менять только у ручных сделок —
// у синканных с биржи их в любом случае перезапишет следующий синк.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServerClient();
    const body = await req.json();

    const { data: existing, error: fetchError } = await supabase
      .from("trades")
      .select("exchange")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    const update: Record<string, unknown> = {};

    // notes — всегда разрешено
    if ("notes" in body) update.notes = body.notes;

    // остальные поля — только для manual
    if (existing.exchange === "manual") {
      const editableFields = [
        "symbol",
        "side",
        "qty",
        "entry_price",
        "close_price",
        "realized_pnl",
        "fee",
        "funding",
        "opened_at",
        "closed_at",
      ];
      for (const field of editableFields) {
        if (field in body) update[field] = body[field];
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("trades")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ trade: data });
  } catch (err) {
    console.error("Trade update error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// DELETE: только ручные сделки — синканные с биржи удалять нельзя (появятся
// снова на следующем синке, и это защищает от случайной потери реальных данных)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchError } = await supabase
      .from("trades")
      .select("exchange")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    if (existing.exchange !== "manual") {
      return NextResponse.json(
        { error: "Можно удалять только вручную добавленные сделки" },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("trades").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Trade delete error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
