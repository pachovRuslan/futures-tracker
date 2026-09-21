import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encrypt, maskKey } from "@/lib/crypto";
import { REGISTRY, EXCHANGES } from "@/lib/exchanges";
import { ConnectionInput } from "@/lib/validation";

// Список подключений — специально выбираем только безопасные колонки.
// Даже случайно не отдадим *_encrypted наружу.
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { data, error } = await supabase
      .from("exchange_connections")
      .select("exchange, key_preview, created_at")
      .order("exchange");

    if (error) throw error;

    return NextResponse.json({ connections: data });
  } catch (err) {
    console.error("Connections list error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Добавление/обновление подключения — сначала проверяем ключ реальным
// запросом к бирже, и только если он рабочий, шифруем и сохраняем.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const parsed = ConnectionInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { exchange, apiKey, apiSecret, passphrase } = parsed.data;

    const adapter = REGISTRY[exchange as (typeof EXCHANGES)[number]];

    // Для бирж с passphrase-схемой проверяем, что passphrase передан.
    if (adapter.credentialsSchema === "key+secret+passphrase" && !passphrase) {
      return NextResponse.json(
        { error: `${adapter.label} требует passphrase — укажите третье поле` },
        { status: 400 }
      );
    }

    const credentials = {
      apiKey,
      apiSecret,
      ...(passphrase ? { passphrase } : {}),
    };

    // Проверяем ключ перед сохранением — иначе узнаешь о невалидном ключе
    // только когда упадёт синк по крону
    try {
      await adapter.testCredentials(credentials);
    } catch (testErr) {
      return NextResponse.json(
        {
          error: `Не удалось подключиться к ${adapter.label} с этим ключом: ${
            testErr instanceof Error ? testErr.message : String(testErr)
          }`,
        },
        { status: 400 }
      );
    }

    const row: Record<string, unknown> = {
      user_id: user.id,
      exchange,
      api_key_encrypted: encrypt(apiKey),
      api_secret_encrypted: encrypt(apiSecret),
      key_preview: maskKey(apiKey),
      updated_at: new Date().toISOString(),
    };

    // Для бирж с passphrase — сохраняем отдельной зашифрованной колонкой.
    if (passphrase) {
      row.passphrase_encrypted = encrypt(passphrase);
    } else {
      // Если юзер переподключает биржу, которая раньше имела passphrase, а теперь нет —
      // затираем старую. (На практике так не бывает, но defensively.)
      row.passphrase_encrypted = null;
    }

    const { error } = await supabase
      .from("exchange_connections")
      .upsert(row, { onConflict: "user_id,exchange" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Connection create error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
