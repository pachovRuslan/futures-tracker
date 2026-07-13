import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getBalanceChartForUser } from "@/lib/balance";

// GET /api/balance/chart — готовый dataset для графика баланса
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const result = await getBalanceChartForUser(user.id);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Balance chart error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
