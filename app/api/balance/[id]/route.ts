import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// DELETE /api/balance/[id] — удалить снапшот
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { error } = await supabase
      .from("balance_snapshots")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // defensive — RLS и так защитит

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Balance delete error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
