import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPremiumUser } from "./entitlements";

/**
 * Миграция 13 (разделение allow/premium): isPremiumUser считает
 * премиумом ТОЛЬКО is_premium (не истёк). Ни is_allowlisted, ни
 * отсутствие строки с последующим фолбэком в allowed_emails премиум
 * не дают.
 */

interface EntitlementRow {
  is_premium: boolean | null;
  expires_at: string | null;
  is_allowlisted?: boolean | null;
}

function makeClient(row: EntitlementRow | null, readError: unknown = null) {
  const maybeSingle = vi.fn(async () => ({ data: row, error: readError }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from };
}

const HOUR = 3_600_000;

describe("isPremiumUser (после миграции 13: allow ≠ premium)", () => {
  it("бессрочная подписка → premium", async () => {
    const { client } = makeClient({ is_premium: true, expires_at: null });
    expect(await isPremiumUser(client, "u1")).toBe(true);
  });

  it("подписка с будущим expires_at → premium", async () => {
    const { client } = makeClient({
      is_premium: true,
      expires_at: new Date(Date.now() + HOUR).toISOString(),
    });
    expect(await isPremiumUser(client, "u1")).toBe(true);
  });

  it("истёкшая подписка → не premium", async () => {
    const { client } = makeClient({
      is_premium: true,
      expires_at: new Date(Date.now() - HOUR).toISOString(),
    });
    expect(await isPremiumUser(client, "u1")).toBe(false);
  });

  it("is_allowlisted = true больше НЕ даёт премиум", async () => {
    const { client } = makeClient({
      is_premium: false,
      is_allowlisted: true,
      expires_at: null,
    });
    expect(await isPremiumUser(client, "u1")).toBe(false);
  });

  it("нет строки в user_entitlements → не premium (фолбэка нет)", async () => {
    const { client, from } = makeClient(null);
    expect(await isPremiumUser(client, "u1")).toBe(false);
    // Ключевая структурная проверка разделения: ровно один запрос,
    // только в user_entitlements — allowed_emails не читается вовсе.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("user_entitlements");
  });

  it("is_premium = false → не premium", async () => {
    const { client } = makeClient({ is_premium: false, expires_at: null });
    expect(await isPremiumUser(client, "u1")).toBe(false);
  });

  it("ошибка чтения → не premium (fail-closed)", async () => {
    const { client } = makeClient(null, { message: "rls denied" });
    expect(await isPremiumUser(client, "u1")).toBe(false);
  });
});
