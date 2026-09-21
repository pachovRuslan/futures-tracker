import { describe, it, expect } from "vitest";
import {
  fmt,
  fmtPnl,
  fmtFee,
  fmtDate,
  tradeNetPnl,
  filterTradesByExchanges,
  calculateMonthStats,
  calculateAllTimeWinRate,
  calculateTotalNetPnl,
  groupTradesByMonth,
  getActiveMonth,
} from "./trade-model";
import type { Trade } from "./types";

// Хелпер — создаёт мок-сделку
function mockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "test-id",
    user_id: "user-1",
    exchange: "bybit",
    external_id: "ext-1",
    symbol: "BTCUSDT",
    side: "long",
    qty: 1,
    entry_price: 50000,
    close_price: 51000,
    realized_pnl: 1000,
    fee: 10,
    funding: 0,
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T14:00:00Z",
    notes: null,
    raw: null,
    ...overrides,
  };
}

describe("Форматирование", () => {
  it("fmt — число с 2 знаками", () => {
    expect(fmt(1234.567)).toMatch(/1.?234,57/);
    expect(fmt(0)).toBe("0,00");
    expect(fmt(-100)).toBe("-100,00");
  });

  it("fmtPnl — со знаком + для прибыли", () => {
    expect(fmtPnl(100)).toBe("+100,00");
    expect(fmtPnl(-50)).toBe("-50,00");
    expect(fmtPnl(0)).toBe("+0,00");
  });

  it("fmtFee — '—' для Bybit с fee=0", () => {
    expect(fmtFee(0, "bybit")).toBe("—");
    expect(fmtFee(5, "bybit")).toBe("5");
    expect(fmtFee(0, "binance")).toBe("0");
  });

  it("fmtDate — дата в ru-RU формате", () => {
    const result = fmtDate("2026-07-01T14:00:00Z");
    expect(result).toMatch(/\d{2}\.\d{2}/);
  });
});

describe("tradeNetPnl", () => {
  it("считает net PnL = realized_pnl - fee + funding", () => {
    expect(tradeNetPnl(mockTrade({ realized_pnl: 1000, fee: 10, funding: 5 }))).toBe(995);
    expect(tradeNetPnl(mockTrade({ realized_pnl: -500, fee: 10, funding: 0 }))).toBe(-510);
    expect(tradeNetPnl(mockTrade({ realized_pnl: 0, fee: 0, funding: 0 }))).toBe(0);
  });
});

describe("filterTradesByExchanges", () => {
  const trades = [
    mockTrade({ id: "1", exchange: "bybit" }),
    mockTrade({ id: "2", exchange: "binance" }),
    mockTrade({ id: "3", exchange: "manual" }),
  ];

  it("фильтрует по выбранным биржам", () => {
    const result = filterTradesByExchanges(trades, new Set(["bybit"]));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("возвращает все если выбраны все", () => {
    const result = filterTradesByExchanges(trades, new Set(["bybit", "binance", "manual"]));
    expect(result).toHaveLength(3);
  });

  it("возвращает пустой массив если ничего не выбрано", () => {
    const result = filterTradesByExchanges(trades, new Set());
    expect(result).toHaveLength(0);
  });
});

describe("calculateMonthStats", () => {
  const trades = [
    mockTrade({ id: "1", closed_at: "2026-07-01T10:00:00Z", realized_pnl: 100, fee: 10, funding: 0 }),
    mockTrade({ id: "2", closed_at: "2026-07-15T10:00:00Z", realized_pnl: -50, fee: 5, funding: 2 }),
    mockTrade({ id: "3", closed_at: "2026-08-01T10:00:00Z", realized_pnl: 200, fee: 0, funding: 0 }),
  ];

  it("считает статистику за июль", () => {
    const stats = calculateMonthStats(trades, "2026-07");
    expect(stats.tradesCount).toBe(2);
    expect(stats.winCount).toBe(1);
    expect(stats.lossCount).toBe(1);
    expect(stats.winRate).toBe("50.0");
    expect(stats.netPnl).toBe(37); // (100-10+0) + (-50-5+2) = 90 - 53 = 37
    expect(stats.fee).toBe(15);
    expect(stats.funding).toBe(2);
  });

  it("считает статистику за август", () => {
    const stats = calculateMonthStats(trades, "2026-08");
    expect(stats.tradesCount).toBe(1);
    expect(stats.winCount).toBe(1);
    expect(stats.lossCount).toBe(0);
    expect(stats.winRate).toBe("100.0");
    expect(stats.netPnl).toBe(200);
  });

  it("возвращает нули для несуществующего месяца", () => {
    const stats = calculateMonthStats(trades, "2026-01");
    expect(stats.tradesCount).toBe(0);
    expect(stats.winRate).toBe("0");
    expect(stats.netPnl).toBe(0);
  });
});

describe("calculateAllTimeWinRate", () => {
  it("считает win-rate по всем сделкам", () => {
    const trades = [
      mockTrade({ id: "1", realized_pnl: 100, fee: 0, funding: 0 }),
      mockTrade({ id: "2", realized_pnl: -50, fee: 0, funding: 0 }),
      mockTrade({ id: "3", realized_pnl: 200, fee: 0, funding: 0 }),
    ];
    expect(calculateAllTimeWinRate(trades)).toBe("66.7"); // 2 из 3 прибыльные
  });

  it("возвращает '0' для пустого массива", () => {
    expect(calculateAllTimeWinRate([])).toBe("0");
  });

  it("считает сделку с net=0 как убыточную (<=0)", () => {
    const trades = [
      mockTrade({ id: "1", realized_pnl: 10, fee: 10, funding: 0 }), // net=0
    ];
    expect(calculateAllTimeWinRate(trades)).toBe("0.0");
  });
});

describe("calculateTotalNetPnl", () => {
  it("суммирует net PnL всех сделок", () => {
    const trades = [
      mockTrade({ id: "1", realized_pnl: 100, fee: 10, funding: 0 }),
      mockTrade({ id: "2", realized_pnl: -50, fee: 5, funding: 2 }),
    ];
    expect(calculateTotalNetPnl(trades)).toBe(37); // 90 + (-53) = 37
  });

  it("возвращает 0 для пустого массива", () => {
    expect(calculateTotalNetPnl([])).toBe(0);
  });
});

describe("groupTradesByMonth", () => {
  it("группирует по месяцам и сортирует по возрастанию", () => {
    const trades = [
      mockTrade({ id: "1", closed_at: "2026-08-01T10:00:00Z", realized_pnl: 200, fee: 0, funding: 0 }),
      mockTrade({ id: "2", closed_at: "2026-07-01T10:00:00Z", realized_pnl: 100, fee: 0, funding: 0 }),
      mockTrade({ id: "3", closed_at: "2026-07-15T10:00:00Z", realized_pnl: -50, fee: 0, funding: 0 }),
    ];
    const result = groupTradesByMonth(trades);
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe("2026-07");
    expect(result[0].trades).toBe(2);
    expect(result[0].netPnl).toBe(50);
    expect(result[1].month).toBe("2026-08");
    expect(result[1].trades).toBe(1);
    expect(result[1].netPnl).toBe(200);
  });

  it("возвращает пустой массив для пустого input", () => {
    expect(groupTradesByMonth([])).toEqual([]);
  });
});

describe("getActiveMonth", () => {
  const chartData = [
    { month: "2026-06", netPnl: 100, trades: 5 },
    { month: "2026-07", netPnl: 200, trades: 10 },
    { month: "2026-08", netPnl: -50, trades: 3 },
  ];

  it("возвращает выбранный месяц если задан", () => {
    expect(getActiveMonth("2026-07", chartData)).toBe("2026-07");
  });

  it("возвращает последний месяц если selectedMonth=null", () => {
    expect(getActiveMonth(null, chartData)).toBe("2026-08");
  });

  it("возвращает null для пустого массива", () => {
    expect(getActiveMonth(null, [])).toBe(null);
  });
});
