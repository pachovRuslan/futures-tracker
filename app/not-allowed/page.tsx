import { createServerSupabaseClient } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";

export default async function NotAllowedPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="text-sm text-[var(--color-text-faint)] tracking-widest uppercase">
          Доступ ограничен
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Аккаунт {user?.email ? <span className="text-[var(--color-text)]">{user.email}</span> : ""}{" "}
          не входит в список разрешённых пользователей этого приложения.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
