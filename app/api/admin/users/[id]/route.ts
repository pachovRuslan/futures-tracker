import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

/**
 * GET /api/admin/users/[id] — детальная статистика конкретного пользователя.
 *
 * Возвращает:
 *   - profile: email, created_at, last_sign_in_at
 *   - connections: список подключений (exchange, key_preview, created_at)
 *   - tradesStats: агрегаты (total, by exchange, by side, win-rate, PnL)
 *   - recentTrades: последние 20 сделок
 *   - monthlySummary: PnL по месяцам (из БД-вьюхи, отфильтровано по user_id)
 *
 * Доступ: только админам (requireAdmin).
 * Использует service_role — обходит RLS, чтобы видеть чужие данные.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, supabase: sessionSupabase } = await requireAdmin();
    if (error) return error;

    const { id: userId } = await params;
    const supabase = getSupabaseServerClient();

    // 1. Профиль пользователя — через RPC (security_definer, читает auth.users)
    const { data: userProfile, error: profileError } = await sessionSupabase.rpc(
      "get_user_by_id",
      { p_user_id: userId }
    );

    if (profileError || !userProfile || userProfile.length === 0) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const profile = Array.isArray(userProfile) ? userProfile[0] : userProfile;

    // 2. Подключения бирж
    const { data: connections, error: connError } = await supabase
      .from("exchange_connections")
      .select("exchange, key_preview, created_at, updated_at")
      .eq("user_id", userId)
      .order("exchange");

    if (connError) throw connError;

    // 3. Сделки — последние 20 + агрегаты
    const { data: recentTrades, error: tradesError } = await supabase
      .from("trades")
      .select(
        "id, exchange, symbol, side, qty, entry_price, close_price, realized_pnl, fee, funding, opened_at, closed_at"
      )
      .eq("user_id", userId)
      .order("closed_at", { ascending: false })
      .limit(20);

    if (tradesError) throw tradesError;

    // 4. Агрегаты — считаем через RPC для эффективности
    const { data: stats, error: statsError } = await sessionSupabase.rpc(
      "get_user_trades_stats",
      { p_user_id: userId }
    );

    let tradesStats;
    if (statsError || !stats) {
      // Fallback — считаем на сервере из recentTrades (неточно для total, но хоть что-то)
      const allTrades = recentTrades ?? [];
      tradesStats = {
        total_trades: allTrades.length,
        total_net_pnl: allTrades.reduce((acc, t) => acc + t.realized_pnl - t.fee + t.funding, 0),
        profitable: allTrades.filter((t) => t.realized_pnl - t.fee + t.funding > 0).length,
        losing: allTrades.filter((t) => t.realized_pnl - t.fee + t.funding <= 0).length,
        by_exchange: {} as Record<string, { count: number; pnl: number }>,
        by_side: { long: 0, short: 0 },
      };
    } else {
      tradesStats = stats;
    }

    // 5. Monthly summary — через RPC (фильтрация по user_id)
    const { data: monthlySummary, error: monthlyError } = await sessionSupabase.rpc(
      "get_user_monthly_summary",
      { p_user_id: userId }
    );

    return NextResponse.json({
      profile: userProfile,
      connections: connections ?? [],
      recentTrades: recentTrades ?? [],
      tradesStats,
      monthlySummary: monthlyError ? [] : monthlySummary ?? [],
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Admin user detail error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
