import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// DELETE /api/admin/allowlist/[email] — удалить email из allowlist
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { user, error, supabase } = await requireAdmin();
    if (error) return error;

    const { email: emailParam } = await params;
    const email = decodeURIComponent(emailParam).toLowerCase();

    // Нельзя удалить самого себя из allowlist — иначе потеряете доступ.
    if (user!.email?.toLowerCase() === email) {
      return NextResponse.json(
        { error: "Нельзя удалить самого себя из allowlist" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("allowed_emails")
      .delete()
      .eq("email", email);

    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin allowlist delete error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Вспомогательная функция — продублирована из route.ts, чтобы работало в [email]/route.ts
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
