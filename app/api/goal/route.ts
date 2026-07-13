import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/goal — получить настройки пользователя (цель + стартовый фьючерс)
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { data, error } = await supabase
      .from("user_settings")
      .select("goal_usd, futures_start_usd")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    // Если настроек ещё нет — возвращаем дефолт
    return NextResponse.json({
      settings: {
        goal_usd: data?.goal_usd ?? null,
        futures_start_usd: data?.futures_start_usd ?? 0,
      },
    });
  } catch (err) {
    console.error("Goal get error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// PUT /api/goal — обновить настройки
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const body = await req.json();
    const { goal_usd, futures_start_usd } = body as {
      goal_usd: number | null;
      futures_start_usd?: number;
    };

    if (goal_usd !== null && (typeof goal_usd !== "number" || goal_usd < 0)) {
      return NextResponse.json({ error: "goal_usd должен быть числом ≥ 0 или null" }, { status: 400 });
    }
    if (futures_start_usd !== undefined && (typeof futures_start_usd !== "number" || futures_start_usd < 0)) {
      return NextResponse.json(
        { error: "futures_start_usd должен быть числом ≥ 0" },
        { status: 400 }
      );
    }

    const row: Record<string, unknown> = {
      user_id: user.id,
      goal_usd,
      updated_at: new Date().toISOString(),
    };
    if (futures_start_usd !== undefined) {
      row.futures_start_usd = futures_start_usd;
    }

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(row, { onConflict: "user_id" })
      .select("goal_usd, futures_start_usd")
      .single();

    if (error) throw error;

    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("Goal update error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
