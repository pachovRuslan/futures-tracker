import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/users — список всех пользователей с подключениями и сделками
export async function GET() {
  try {
    const { error, supabase } = await requireAdmin();
    if (error) return error;

    // Используем SQL-функцию get_users_overview() — security_definer,
    // чтобы обойти RLS и прочитать auth.users + чужие trades/connections.
    const { data, error: rpcError } = await supabase.rpc("get_users_overview");

    if (rpcError) throw rpcError;

    return NextResponse.json({ users: data });
  } catch (err) {
    console.error("Admin users get error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
