import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      user: null,
      error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }),
      supabase,
    };
  }

  const { data: dbAllowlist } = await supabase
    .from("allowed_emails")
    .select("email");

  const envAllowedEmails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isInDb = dbAllowlist?.some(
    (row) => row.email.toLowerCase() === user.email!.toLowerCase()
  );
  const isInEnv = envAllowedEmails.includes(user.email.toLowerCase());

  if (!isInDb && !isInEnv) {
    return {
      user: null,
      error: NextResponse.json({ error: "Доступ запрещён" }, { status: 403 }),
      supabase,
    };
  }

  return { user, error: null, supabase };
}
