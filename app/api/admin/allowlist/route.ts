import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Проверка, что текущий пользователь — админ (т.е. есть в allowlist).
 * Согласно архитектуре, все из allowlist = админы (нет отдельного ADMIN_EMAILS).
 *
 * Возвращает user или null (с ответом 403).
 */
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

  // Проверяем, что email в allowlist (БД или env fallback)
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

// GET /api/admin/allowlist — список всех email-ов в allowlist
export async function GET() {
  try {
    const { error, supabase } = await requireAdmin();
    if (error) return error;

    // Читаем из БД
    const { data: dbEmails, error: dbError } = await supabase
      .from("allowed_emails")
      .select("email, added_at, added_by, note")
      .order("added_at", { ascending: false });

    if (dbError) throw dbError;

    // Также показываем email-ы из env (если они не в БД — помечаем источник)
    const envAllowedEmails = (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const dbEmailsList = (dbEmails ?? []).map((e) => ({
      ...e,
      source: "db" as const,
    }));

    // Email-ы из env, которых нет в БД
    const dbEmailsSet = new Set(dbEmailsList.map((e) => e.email.toLowerCase()));
    const envOnlyEmails = envAllowedEmails
      .filter((e) => !dbEmailsSet.has(e))
      .map((e) => ({
        email: e,
        added_at: null,
        added_by: null,
        note: "из env (ALLOWED_EMAILS)",
        source: "env" as const,
      }));

    return NextResponse.json({
      allowlist: [...dbEmailsList, ...envOnlyEmails],
    });
  } catch (err) {
    console.error("Admin allowlist get error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/admin/allowlist — добавить email в allowlist
export async function POST(req: NextRequest) {
  try {
    const { user, error, supabase } = await requireAdmin();
    if (error) return error;

    const body = await req.json();
    const { email, note } = body as { email: string; note?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Некорректный email" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data, error: insertError } = await supabase
      .from("allowed_emails")
      .upsert(
        {
          email: normalizedEmail,
          note: note || null,
          added_by: user!.id,
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, entry: data });
  } catch (err) {
    console.error("Admin allowlist add error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
