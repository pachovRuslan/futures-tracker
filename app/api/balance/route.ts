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
//
// Поддержка двух режимов ввода (для удобства пользователя):
//   1. Абсолют (по умолчанию): body.value_usd = итоговая сумма на дату.
//      Например, value_usd: 1500 = "у меня сейчас $1500 на споте".
//   2. Дельта: body.is_delta = true, body.value_usd = внесённое изменение.
//      Например, value_usd: 200 = "пополнил спот на $200".
//      Бэкенд сам находит последний снапшот до этой даты и прибавляет дельту:
//      new_value = previous_value + delta. Если предыдущего нет — ошибка
//      (первая точка должна быть абсолютной).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const body = await req.json();
    const { type, value_usd, snapshot_date, note, is_delta } = body as {
      type: "spot" | "futures";
      value_usd: number;
      snapshot_date: string; // YYYY-MM-DD
      note?: string;
      is_delta?: boolean;
    };

    if (!type || value_usd === undefined || !snapshot_date) {
      return NextResponse.json(
        { error: "type, value_usd и snapshot_date обязательны" },
        { status: 400 }
      );
    }
    if (!["spot", "futures"].includes(type)) {
      return NextResponse.json({ error: "type должен быть 'spot' или 'futures'" }, { status: 400 });
    }

    let finalValueUsd = value_usd;

    // Если режим дельты — вычисляем итог из предыдущего снапшота.
    if (is_delta) {
      const { data: prev, error: prevError } = await supabase
        .from("balance_snapshots")
        .select("value_usd, snapshot_date")
        .eq("user_id", user.id)
        .eq("type", type)
        .lt("snapshot_date", snapshot_date)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevError) throw prevError;

      if (!prev) {
        return NextResponse.json(
          {
            error:
              "Невозможно использовать дельту для первой точки — предыдущего баланса нет. " +
              "Выберите режим 'Итог' и введите полную сумму.",
          },
          { status: 400 }
        );
      }

      finalValueUsd = Number(prev.value_usd) + value_usd;

      // Если итог получился отрицательным — это странно (баланс не может быть < 0).
      // Разрешаем, но предупреждаем в ответе.
      if (finalValueUsd < 0) {
        console.warn(
          `[balance] user=${user.id} type=${type} delta=${value_usd} resulted in negative balance ${finalValueUsd}`
        );
      }
    }

    const row = {
      user_id: user.id,
      type,
      value_usd: finalValueUsd,
      snapshot_date,
      note: note || null,
    };

    const { data, error } = await supabase
      .from("balance_snapshots")
      .upsert(row, { onConflict: "user_id,type,snapshot_date" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      snapshot: data,
      ...(is_delta ? { applied_delta: value_usd, previous_value: finalValueUsd - value_usd } : {}),
    });
  } catch (err) {
    console.error("Balance create error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
