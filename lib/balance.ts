import { getSupabaseServerClient } from "@/lib/supabase";
import type { BalanceChartPoint, UserSettings, Trade } from "@/lib/types";

/**
 * Расчёт исторического баланса пользователя для графика.
 *
 * Алгоритм (Вариант C — гибрид):
 *
 * 1. Находим дату первой сделки — это старт графика.
 * 2. Строим массив дат от старта до сегодня + 30 дней в будущее.
 * 3. Для каждой даты считаем:
 *    - SPOT: если есть ручной снапшот на эту дату — берём его. Иначе null
 *      (спот рисуется только там, где юзер ввёл данные; между точками —
 *      smooth curve от recharts интерполирует).
 *    - FUTURES: стартовая сумма + сумма PnL всех сделок до этой даты.
 *      Если есть ручной снапшот на эту дату — берём его (override).
 * 4. SPREAD = |spot - futures| (если оба не null).
 *
 * В будущем можно добавить точку цели как последнюю точку графика —
 * но пока цель просто горизонтальная линия (ReferenceLine в recharts).
 *
 * ВАЖНО: функция принимает userId явно — service_role обходит RLS,
 * поэтому фильтр по user_id обязательный.
 */
export async function getBalanceChartForUser(
  userId: string
): Promise<{
  points: BalanceChartPoint[];
  settings: UserSettings;
  startDate: string | null;
  endDate: string;
}> {
  const supabase = getSupabaseServerClient();

  // 1. Настройки пользователя (цель, стартовый фьючерсный капитал)
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("goal_usd, futures_start_usd")
    .eq("user_id", userId)
    .maybeSingle();

  const settings: UserSettings = {
    goal_usd: settingsRow?.goal_usd ?? null,
    futures_start_usd: settingsRow?.futures_start_usd ?? 0,
  };

  // 2. Дата первой сделки — старт графика
  const { data: firstTrade } = await supabase
    .from("trades")
    .select("closed_at")
    .eq("user_id", userId)
    .order("closed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstTrade) {
    // Сделок нет — график пустой
    return {
      points: [],
      settings,
      startDate: null,
      endDate: new Date().toISOString().slice(0, 10),
    };
  }

  const startDate = new Date(firstTrade.closed_at);
  const startDateStr = startDate.toISOString().slice(0, 10);

  // Конец графика — сегодня + 30 дней в будущее (для визуального запаса)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // 3. Все сделки пользователя (PnL)
  const { data: trades } = await supabase
    .from("trades")
    .select("closed_at, realized_pnl, fee, funding")
    .eq("user_id", userId)
    .order("closed_at", { ascending: true });

  // 4. Все ручные снапшоты (spot + futures)
  const { data: snapshots } = await supabase
    .from("balance_snapshots")
    .select("id, type, value_usd, snapshot_date, note, created_at")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: true });

  const spotSnapshots = (snapshots ?? []).filter((s) => s.type === "spot");
  const futuresSnapshots = (snapshots ?? []).filter((s) => s.type === "futures");

  // 5. Строим массив дат с дневным шагом.
  //    Если период > 365 дней — агрегируем по неделям, чтобы не тянуть 5+ лет точек.
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const stepDays = totalDays > 365 ? 7 : 1;

  const points: BalanceChartPoint[] = [];
  let cumulativePnl = 0;
  let tradeIdx = 0;
  const typedTrades: Trade[] = (trades ?? []) as unknown as Trade[];

  // Forward-fill для spot: если ввели $1000 14 июля, то 15-16-17 июля
  // спот остаётся $1000 (пока не введёте новое значение). Без этого линия
  // spot рисуется только в точках ввода (нужно 2+ точки), а spread
  // считается только там, где spot не null — получается одна точка.
  let lastSpot: { value: number; date: string } | null = null;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + stepDays)) {
    const dateStr = d.toISOString().slice(0, 10);

    // Накапливаем PnL сделок до этой даты
    while (
      tradeIdx < typedTrades.length &&
      typedTrades[tradeIdx].closed_at.slice(0, 10) <= dateStr
    ) {
      const t = typedTrades[tradeIdx];
      cumulativePnl += t.realized_pnl - t.fee + t.funding;
      tradeIdx++;
    }

    // SPOT — forward-fill: берём последний снапшот на или до этой даты.
    // Если есть новый снапшот на эту дату — обновляем lastSpot.
    // Если снапшотов ещё не было вообще — spot = null (не рисуем до первой точки).
    const spotSnap = spotSnapshots.find((s) => s.snapshot_date === dateStr);
    if (spotSnap) {
      lastSpot = { value: Number(spotSnap.value_usd), date: dateStr };
    } else if (lastSpot && lastSpot.date > dateStr) {
      // Защита: если мы каким-то образом оказались раньше первой точки — сбрасываем
      lastSpot = null;
    }

    const spot = lastSpot ? lastSpot.value : null;
    const isManualSpot = !!spotSnap;

    // FUTURES — auto (старт + PnL), но ручной снапшот переопределяет
    const futuresSnap = futuresSnapshots.find((s) => s.snapshot_date === dateStr);
    const futures = futuresSnap
      ? Number(futuresSnap.value_usd)
      : settings.futures_start_usd + cumulativePnl;

    // SPREAD = |spot - futures| (только если spot известен)
    const spread = spot !== null ? Math.abs(spot - futures) : null;

    points.push({
      date: dateStr,
      spot,
      futures,
      spread,
      is_manual_spot: isManualSpot,
      is_manual_futures: !!futuresSnap,
    });
  }

  return {
    points,
    settings,
    startDate: startDateStr,
    endDate: endDateStr,
  };
}
