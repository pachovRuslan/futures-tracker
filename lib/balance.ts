import { getSupabaseServerClient } from "@/lib/supabase";
import type { BalanceChartPoint, UserSettings } from "@/lib/types";

/**
 * Расчёт исторического баланса пользователя для графика.
 *
 * ВАЖНО: после отвязки от PnL сделок (август 2026) график стал чисто
 * депозитным трекером — только ручной ввод. Никаких auto-данных из бирж.
 *
 * Алгоритм:
 *
 * 1. Находим старт графика — самая ранняя дата из (первая сделка, первый
 *    снапшот). Если нет ни сделок, ни снапшотов — график пустой.
 * 2. Строим массив дат от старта до сегодня + 30 дней в будущее.
 * 3. Для каждой даты считаем:
 *    - SPOT: forward-fill — берём последний ручной снапшот на или до этой
 *      даты. До первой точки — null.
 *    - FUTURES: forward-fill — так же, как спот. Больше НЕ считается из
 *      PnL сделок. Только ручной ввод.
 * 4. SPREAD = |spot - futures| (если оба не null).
 *
 * futures_start_usd из user_settings больше НЕ используется для расчёта —
 * поле оставлено в БД для совместимости, но игнорируется.
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

  // 1. Настройки пользователя (только goal_usd, futures_start_usd игнорируем)
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("goal_usd, futures_start_usd")
    .eq("user_id", userId)
    .maybeSingle();

  const settings: UserSettings = {
    goal_usd: settingsRow?.goal_usd ?? null,
    futures_start_usd: settingsRow?.futures_start_usd ?? 0,
  };

  // 2. Все ручные снапшоты (spot + futures)
  const { data: snapshots } = await supabase
    .from("balance_snapshots")
    .select("id, type, value_usd, snapshot_date, note, created_at")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: true });

  const spotSnapshots = (snapshots ?? []).filter((s) => s.type === "spot");
  const futuresSnapshots = (snapshots ?? []).filter((s) => s.type === "futures");

  // 3. Старт графика — самая ранняя дата из (первая сделка, первый снапшот).
  //    Сделки всё ещё нужны для определения периода (если пользователь торгует,
  //    но ещё не ввёл снапшоты — показать пустой график за период торговли).
  const { data: firstTrade } = await supabase
    .from("trades")
    .select("closed_at")
    .eq("user_id", userId)
    .order("closed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstSnapshotDate = snapshots && snapshots.length > 0
    ? snapshots[0].snapshot_date
    : null;
  const firstTradeDate = firstTrade ? firstTrade.closed_at.slice(0, 10) : null;

  // Берём минимум из доступных дат
  const startDateCandidates = [firstTradeDate, firstSnapshotDate].filter(
    (d): d is string => d !== null
  );

  if (startDateCandidates.length === 0) {
    // Нет ни сделок, ни снапшотов — график пустой
    return {
      points: [],
      settings,
      startDate: null,
      endDate: new Date().toISOString().slice(0, 10),
    };
  }

  const startDateStr = startDateCandidates.sort()[0];
  const startDate = new Date(startDateStr);

  // Конец графика — сегодня + 30 дней в будущее (для визуального запаса)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // 4. Строим массив дат с дневным шагом.
  //    Если период > 365 дней — агрегируем по неделям, чтобы не тянуть 5+ лет точек.
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const stepDays = totalDays > 365 ? 7 : 1;

  const points: BalanceChartPoint[] = [];

  // Forward-fill для spot и futures: если ввели $1000 14 июля, то 15-16-17 июля
  // значение остаётся $1000 (пока не введёте новое). Без этого линии
  // рисуются только в точках ввода (нужно 2+ точки), а spread
  // считается только там, где оба значения не null — получается одна точка.
  let lastSpot: { value: number; date: string } | null = null;
  let lastFutures: { value: number; date: string } | null = null;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + stepDays)) {
    const dateStr = d.toISOString().slice(0, 10);

    // SPOT — forward-fill: берём последний снапшот на или до этой даты.
    const spotSnap = spotSnapshots.find((s) => s.snapshot_date === dateStr);
    if (spotSnap) {
      lastSpot = { value: Number(spotSnap.value_usd), date: dateStr };
    } else if (lastSpot && lastSpot.date > dateStr) {
      // Защита: если мы каким-то образом оказались раньше первой точки — сбрасываем
      lastSpot = null;
    }
    const spot = lastSpot ? lastSpot.value : null;
    const isManualSpot = !!spotSnap;

    // FUTURES — forward-fill, так же как spot. Больше НЕ считается из PnL.
    const futuresSnap = futuresSnapshots.find((s) => s.snapshot_date === dateStr);
    if (futuresSnap) {
      lastFutures = { value: Number(futuresSnap.value_usd), date: dateStr };
    } else if (lastFutures && lastFutures.date > dateStr) {
      lastFutures = null;
    }
    const futures = lastFutures ? lastFutures.value : null;
    const isManualFutures = !!futuresSnap;

    // SPREAD = |spot - futures| (только если оба известны)
    const spread = spot !== null && futures !== null ? Math.abs(spot - futures) : null;

    points.push({
      date: dateStr,
      spot,
      futures,
      spread,
      is_manual_spot: isManualSpot,
      is_manual_futures: isManualFutures,
    });
  }

  return {
    points,
    settings,
    startDate: startDateStr,
    endDate: endDateStr,
  };
}
