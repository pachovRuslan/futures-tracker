import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

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

    // Нельзя удалить самого себя из allowlist — иначе потеряете доступ,
    // если ваш email не в ADMIN_EMAILS.
    if (user!.email.toLowerCase() === email) {
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
