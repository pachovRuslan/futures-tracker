import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

// POST /api/balance — добавить или обновить снапшот (upsert по user+type+date)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const body = await req.json();
    const { type, value_usd, snapshot_date, note } = body as {
      type: "spot" | "futures";
      value_usd: number;
      snapshot_date: string; // YYYY-MM-DD
      note?: string;
    };

    if (!type || !value_usd || !snapshot_date) {
      return NextResponse.json(
        { error: "type, value_usd и snapshot_date обязательны" },
        { status: 400 }
      );
    }
    if (!["spot", "futures"].includes(type)) {
      return NextResponse.json({ error: "type должен быть 'spot' или 'futures'" }, { status: 400 });
    }

    const row = {
      user_id: user.id,
      type,
      value_usd,
      snapshot_date,
      note: note || null,
    };

    const { data, error } = await supabase
      .from("balance_snapshots")
      .upsert(row, { onConflict: "user_id,type,snapshot_date" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ snapshot: data });
  } catch (err) {
    console.error("Balance create error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
