import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { BalanceSnapshotInput } from "@/lib/validation";

// GET /api/balance — список снапшотов пользователя
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { data, error } = await supabase
      .from("balance_snapshots")
      .select("id, type, value_usd, snapshot_date, note, created_at")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ snapshots: data });
  } catch (err) {
    console.error("Balance list error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/balance — добавить или обновить снапшот
// Поддержка двух режимов:
//   1. Абсолют (по умолчанию): value_usd = итоговая сумма
//   2. Дельта: is_delta=true, value_usd = изменение
//      Бэкенд атомарно через RPC находит prev и прибавляет дельту.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    // Валидация через zod
    const parsed = BalanceSnapshotInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { type, value_usd, snapshot_date, note, is_delta } = parsed.data;

    // Режим дельты — через RPC (атомарно, без race condition)
    if (is_delta) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "apply_balance_delta",
        {
          p_user_id: user.id,
          p_type: type,
          p_snapshot_date: snapshot_date,
          p_delta: value_usd,
          p_note: note ?? null,
        }
      );

      if (rpcError) throw rpcError;

      // RPC возвращает JSON: { error: "..." } или { value_usd, previous_value, applied_delta }
      if (rpcResult && typeof rpcResult === "object" && "error" in rpcResult) {
        return NextResponse.json({ error: rpcResult.error }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        snapshot: rpcResult,
      });
    }

    // Режим абсолюта — обычный upsert
    const row = {
      user_id: user.id,
      type,
      value_usd,
      snapshot_date,
      note: note ?? null,
    };

    const { data, error } = await supabase
      .from("balance_snapshots")
      .upsert(row, { onConflict: "user_id,type,snapshot_date" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ snapshot: data });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Balance create error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
