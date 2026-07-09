"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  async function signInWithGoogle() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-10 py-12">
        <div className="text-sm text-[var(--color-text-faint)] tracking-widest uppercase">
          Futures Tracker
        </div>
        <button
          onClick={signInWithGoogle}
          className="px-5 py-2.5 rounded-md bg-white text-black text-sm font-medium hover:bg-gray-100"
        >
          Войти через Google
        </button>
      </div>
    </div>
  );
}
