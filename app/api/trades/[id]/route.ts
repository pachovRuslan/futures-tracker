import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { TradePatchInput } from "@/lib/validation";

// PATCH: заметки можно редактировать у ЛЮБОЙ своей сделки (bybit/bitunix/manual).
// Остальные поля (цена, qty, pnl и т.д.) можно менять только у ручных сделок —
// у синканных с биржи их в любом случае перезапишет следующий синк.
// RLS (policy на update) сам не даст обновить чужую сделку — здесь дополнительно
// проверяем только тип биржи, а не принадлежность пользователю.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    // Валидация через zod
    const parsed = TradePatchInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Явный фильтр по user_id — defensive coding поверх RLS.
    const { data: existing, error: fetchError } = await supabase
      .from("trades")
      .select("exchange")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchError) throw fetchError;

    const update: Record<string, unknown> = {};

    if (body.notes !== undefined) update.notes = body.notes;

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
      ] as const;
      for (const field of editableFields) {
        if (body[field] !== undefined) update[field] = body[field];
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("trades")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
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

// DELETE: только ручные сделки. RLS отдельно не даст удалить чужую сделку.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Явный фильтр по user_id — defensive coding поверх RLS.
    const { data: existing, error: fetchError } = await supabase
      .from("trades")
      .select("exchange")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchError) throw fetchError;

    if (existing.exchange !== "manual") {
      return NextResponse.json(
        { error: "Можно удалять только вручную добавленные сделки" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
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
