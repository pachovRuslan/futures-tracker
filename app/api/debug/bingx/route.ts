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

    const now = Date.now();
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

    // === Запрос 1: positionHistory для BTC-USDT ===
    const positionParams: Record<string, string> = {
      symbol: "BTC-USDT",
      startTs: String(threeMonthsAgo),
      endTs: String(now),
      pageIndex: "1",
      pageSize: "10",
      timestamp: String(now),
      recvWindow: "5000",
    };
    const positionQs = Object.keys(positionParams)
      .sort()
      .map((k) => `${k}=${positionParams[k]}`)
      .join("&");
    const positionSig = crypto.createHmac("sha256", apiSecret).update(positionQs).digest("hex");
    const positionUrl = `https://open-api.bingx.com/openApi/swap/v1/trade/positionHistory?${positionQs}&signature=${positionSig}`;

    const positionRes = await fetch(positionUrl, {
      method: "GET",
      headers: { "X-BX-APIKEY": apiKey, "X-SOURCE-KEY": "BX-AI-SKILL" },
    });
    const positionText = await positionRes.text();
    let positionJson: unknown;
    try {
      positionJson = JSON.parse(positionText);
    } catch {
      positionJson = { parseError: "not JSON", raw: positionText.slice(0, 500) };
    }

    // === Запрос 2: income endpoint — показывает ВСЕ доходы (PnL, фандинг, комиссии) ===
    // НЕ требует symbol — возвращает всё за период
    const incomeParams: Record<string, string> = {
      startTime: String(threeMonthsAgo),
      endTime: String(now),
      limit: "50",
      timestamp: String(now),
      recvWindow: "5000",
    };
    const incomeQs = Object.keys(incomeParams)
      .sort()
      .map((k) => `${k}=${incomeParams[k]}`)
      .join("&");
    const incomeSig = crypto.createHmac("sha256", apiSecret).update(incomeQs).digest("hex");
    const incomeUrl = `https://open-api.bingx.com/openApi/swap/v2/user/income?${incomeQs}&signature=${incomeSig}`;

    const incomeRes = await fetch(incomeUrl, {
      method: "GET",
      headers: { "X-BX-APIKEY": apiKey, "X-SOURCE-KEY": "BX-AI-SKILL" },
    });
    const incomeText = await incomeRes.text();
    let incomeJson: unknown;
    try {
      incomeJson = JSON.parse(incomeText);
    } catch {
      incomeJson = { parseError: "not JSON", raw: incomeText.slice(0, 500) };
    }

    return NextResponse.json({
      positionHistory: {
        url: positionUrl,
        status: positionRes.status,
        body: positionJson,
      },
      income: {
        url: incomeUrl,
        status: incomeRes.status,
        body: incomeJson,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

