import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { encrypt, maskKey } from "@/lib/crypto";
import { testBybitCredentials } from "@/lib/exchanges/bybit";
import { testBitunixCredentials } from "@/lib/exchanges/bitunix";

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
    console.error("Connections list error", err);
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

    const body = await req.json();
    const { exchange, apiKey, apiSecret } = body as {
      exchange: "bybit" | "bitunix";
      apiKey: string;
      apiSecret: string;
    };

    if (!exchange || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "exchange, apiKey и apiSecret обязательны" },
        { status: 400 }
      );
    }
    if (!["bybit", "bitunix"].includes(exchange)) {
      return NextResponse.json({ error: "Неизвестная биржа" }, { status: 400 });
    }

    // Проверяем ключ перед сохранением — иначе узнаешь о невалидном ключе
    // только когда упадёт синк по крону
    try {
      if (exchange === "bybit") {
        await testBybitCredentials({ apiKey, apiSecret });
      } else {
        await testBitunixCredentials({ apiKey, apiSecret });
      }
    } catch (testErr) {
      return NextResponse.json(
        {
          error: `Не удалось подключиться к бирже с этим ключом: ${
            testErr instanceof Error ? testErr.message : String(testErr)
          }`,
        },
        { status: 400 }
      );
    }

    const row = {
      user_id: user.id,
      exchange,
      api_key_encrypted: encrypt(apiKey),
      api_secret_encrypted: encrypt(apiSecret),
      key_preview: maskKey(apiKey),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("exchange_connections")
      .upsert(row, { onConflict: "user_id,exchange" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Connection create error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
