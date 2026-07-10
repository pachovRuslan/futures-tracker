import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ exchange: string }> }
) {
  try {
    const { exchange } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { error } = await supabase
      .from("exchange_connections")
      .delete()
      // Двойная защита: RLS и так не даст удалить чужое подключение, но
      // явный фильтр по user_id — defensive coding, чтобы баг в RLS
      // не привёл к утечке.
      .eq("user_id", user.id)
      .eq("exchange", exchange);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Connection delete error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
