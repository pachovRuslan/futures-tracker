import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decrypt } from "@/lib/crypto";
import crypto from "crypto";

/**
 * ВРЕМЕННЫЙ debug-эндпоинт для диагностики BingX API.
 *
 * Делает ОДИН запрос к /openApi/swap/v1/trade/positionHistory и возвращает
 * СЫРОЙ JSON ответ от BingX — без парсинга. Это покажет реальную структуру
 * ответа, чтобы понять, почему сделки не парсятся.
 *
 * Доступ: любой залогиненный пользователь (для своего BingX подключения).
 * УДАЛИТЬ после диагностики — не должен быть в продакшене.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    // Читаем BingX подключение текущего юзера
    const serviceSupabase = getSupabaseServerClient();
    const { data: connection, error: connError } = await serviceSupabase
      .from("exchange_connections")
      .select("api_key_encrypted, api_secret_encrypted")
      .eq("user_id", user.id)
      .eq("exchange", "bingx")
      .maybeSingle();

    if (connError) throw connError;
    if (!connection) {
      return NextResponse.json({ error: "BingX не подключён" }, { status: 400 });
    }

    const apiKey = decrypt(connection.api_key_encrypted);
    const apiSecret = decrypt(connection.api_secret_encrypted);

    // Делаем запрос к BingX positionHistory для BTC-USDT за последние 3 месяца
    const now = Date.now();
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

    const params: Record<string, string> = {
      symbol: "BTC-USDT",
      startTs: String(threeMonthsAgo),
      endTs: String(now),
      pageIndex: "1",
      pageSize: "10",
      timestamp: String(now),
      recvWindow: "5000",
    };

    // Подпись (как в bingx.ts)
    const queryString = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");

    const url = `https://open-api.bingx.com/openApi/swap/v1/trade/positionHistory?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-BX-APIKEY": apiKey,
        "X-SOURCE-KEY": "BX-AI-SKILL",
      },
    });

    const responseText = await res.text();
    let responseJson: unknown;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { parseError: "Response is not JSON", raw: responseText.slice(0, 1000) };
    }

    return NextResponse.json({
      request: {
        url,
        method: "GET",
        params,
      },
      response: {
        status: res.status,
        statusText: res.statusText,
        body: responseJson,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

