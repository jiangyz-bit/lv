import { holdings as defaultHoldings } from "./mockData";
import { getBrowserMarketDataClient, mergeRealQuotesIntoSnapshot, type RealMarketDataClient } from "./realMarketData";
import type { DataProviderMode, Holding, ManualDataInput, MarketSnapshot, MarginHeatPoint, QuotePoint, Scenario, SnapshotProviderStatus, StockId } from "./types";

export interface MarketDataProvider {
  id: DataProviderMode | string;
  label: string;
  getSnapshot: () => Promise<MarketSnapshot>;
}

type CommoditySnapshot = MarketSnapshot["commodities"];

export function createMockMarketDataProvider(scenarioId = "cooling", portfolioHoldings: Holding[] = defaultHoldings): MarketDataProvider {
  return {
    id: "mock",
    label: "本地模拟数据",
    getSnapshot: async () => mockSnapshotForScenario(scenarioId, new Date(), portfolioHoldings)
  };
}

export function createManualMarketDataProvider(input: ManualDataInput, portfolioHoldings: Holding[] = defaultHoldings): MarketDataProvider {
  return {
    id: "manual",
    label: "手动录入数据",
    getSnapshot: async () => buildManualSnapshot(input, new Date(), portfolioHoldings)
  };
}

export function createRealMarketDataProvider(
  portfolioHoldings: Holding[] = defaultHoldings,
  cachedSnapshot?: MarketSnapshot,
  client: RealMarketDataClient | undefined = getBrowserMarketDataClient()
): MarketDataProvider {
  return {
    id: "real",
    label: "真实数据接口",
    getSnapshot: async () => buildRealSnapshot(portfolioHoldings, cachedSnapshot, client)
  };
}

export function buildManualSnapshot(input: ManualDataInput, now = new Date(), portfolioHoldings: Holding[] = defaultHoldings): MarketSnapshot {
  const timestamp = now.toISOString();
  const base = mockSnapshotForScenario("cooling", now, portfolioHoldings);
  const ids = configuredStockIds(portfolioHoldings, input);

  return {
    ...base,
    source: "manual",
    updatedAt: timestamp,
    providerStatus: [providerStatus("manual", "手动录入", "ok", timestamp)],
    quotes: Object.fromEntries(ids.map((stockId) => [stockId, manualQuote(stockId, input, timestamp)])),
    commodities: {
      gold: { ...base.commodities.gold, ...input.commodities?.gold, source: "manual", updatedAt: timestamp },
      antimony: { ...base.commodities.antimony, ...input.commodities?.antimony, source: "manual", updatedAt: timestamp },
      tungsten: { ...base.commodities.tungsten, ...input.commodities?.tungsten, source: "manual", updatedAt: timestamp },
      minorMetals: { ...base.commodities.minorMetals, ...input.commodities?.minorMetals, source: "manual", updatedAt: timestamp }
    },
    announcements: input.announcements ?? [],
    news: input.news ?? [],
    marginHeat: Object.fromEntries(ids.map((stockId) => [stockId, manualMargin(stockId, input, timestamp)]))
  };
}

export function mergeSnapshots(base: MarketSnapshot, override?: MarketSnapshot): MarketSnapshot {
  if (!override) return base;

  return {
    source: "mock+manual",
    updatedAt: override.updatedAt,
    providerStatus: [...(base.providerStatus ?? []), ...(override.providerStatus ?? [])],
    stale: Boolean(base.stale || override.stale),
    errors: [...(base.errors ?? []), ...(override.errors ?? [])],
    quotes: mergeRecord(base.quotes, override.quotes),
    commodities: {
      gold: { ...base.commodities.gold, ...override.commodities.gold },
      antimony: { ...base.commodities.antimony, ...override.commodities.antimony },
      tungsten: { ...base.commodities.tungsten, ...override.commodities.tungsten },
      minorMetals: { ...base.commodities.minorMetals, ...override.commodities.minorMetals }
    },
    announcements: [...base.announcements, ...override.announcements],
    news: [...base.news, ...override.news],
    marginHeat: mergeRecord(base.marginHeat, override.marginHeat)
  };
}

export async function loadSnapshot(
  mode: DataProviderMode,
  scenario: Scenario,
  manualInput: ManualDataInput,
  portfolioHoldings: Holding[] = defaultHoldings,
  cachedSnapshot?: MarketSnapshot,
  realClient?: RealMarketDataClient
): Promise<MarketSnapshot> {
  if (mode === "real") {
    return createRealMarketDataProvider(portfolioHoldings, cachedSnapshot, realClient).getSnapshot();
  }

  const mock = await createMockMarketDataProvider(scenario.id, portfolioHoldings).getSnapshot();
  if (mode === "mock") return mock;

  const manual = await createManualMarketDataProvider(manualInput, portfolioHoldings).getSnapshot();
  if (mode === "manual") return manual;
  return mergeSnapshots(mock, manual);
}

function mockSnapshotForScenario(scenarioId: string, now = new Date(), portfolioHoldings: Holding[] = defaultHoldings): MarketSnapshot {
  const updatedAt = now.toISOString();
  const common = {
    source: "mock" as const,
    updatedAt
  };

  const coolingQuotes: Record<StockId, QuotePoint> = {
    "hunan-gold": { changePct: -2.1, turnoverRate: 6.2, price: 19.1, ...common },
    "china-tungsten": { changePct: -2.6, turnoverRate: 6.8, price: 13.8, ...common }
  };
  const coolingMargin: Record<StockId, MarginHeatPoint> = {
    "hunan-gold": { stockId: "hunan-gold", heat: "normal", balanceChangePct: 2.6, ...common },
    "china-tungsten": { stockId: "china-tungsten", heat: "hot", balanceChangePct: 4.8, ...common }
  };
  const coolingCommodities: CommoditySnapshot = {
    gold: { trend: "down", changePct: -1.1, priceLabel: "短线承压", ...common },
    antimony: { trend: "down", changePct: -1.8, priceLabel: "高位回落", ...common },
    tungsten: { trend: "flat", changePct: -0.4, priceLabel: "高位僵持", ...common },
    minorMetals: { trend: "down", changePct: -2.2, priceLabel: "板块调整", ...common }
  };

  const presets: Record<string, { quotes: Record<StockId, QuotePoint>; commodities: CommoditySnapshot; marginHeat: Record<StockId, MarginHeatPoint>; announcements?: MarketSnapshot["announcements"]; news?: MarketSnapshot["news"] }> = {
    normal: {
      quotes: {
        "hunan-gold": { changePct: 1.2, turnoverRate: 3.5, price: 19.8, ...common },
        "china-tungsten": { changePct: 1.8, turnoverRate: 4.2, price: 14.6, ...common }
      },
      commodities: {
        gold: { trend: "up", changePct: 1.1, priceLabel: "企稳上行", ...common },
        antimony: { trend: "up", changePct: 1.4, priceLabel: "止跌回升", ...common },
        tungsten: { trend: "up", changePct: 0.8, priceLabel: "高位稳住", ...common },
        minorMetals: { trend: "flat", changePct: 0.2, priceLabel: "分化企稳", ...common }
      },
      marginHeat: {
        "hunan-gold": { stockId: "hunan-gold", heat: "normal", balanceChangePct: 1.2, ...common },
        "china-tungsten": { stockId: "china-tungsten", heat: "normal", balanceChangePct: 1.5, ...common }
      }
    },
    overheated: {
      quotes: {
        "hunan-gold": { changePct: 4.6, turnoverRate: 12.2, price: 22.1, ...common },
        "china-tungsten": { changePct: 5.2, turnoverRate: 13.4, price: 16.7, ...common }
      },
      commodities: {
        gold: { trend: "up", changePct: 1.8, priceLabel: "仍偏强", ...common },
        antimony: { trend: "up", changePct: 2.1, priceLabel: "高位偏强", ...common },
        tungsten: { trend: "up", changePct: 1.7, priceLabel: "高位偏强", ...common },
        minorMetals: { trend: "up", changePct: 2.8, priceLabel: "情绪升温", ...common }
      },
      marginHeat: {
        "hunan-gold": { stockId: "hunan-gold", heat: "hot", balanceChangePct: 8.4, ...common },
        "china-tungsten": { stockId: "china-tungsten", heat: "hot", balanceChangePct: 9.1, ...common }
      }
    },
    "red-risk": {
      quotes: {
        "hunan-gold": { changePct: -5.8, turnoverRate: 10.5, price: 18.2, ...common },
        "china-tungsten": { changePct: -6.4, turnoverRate: 11.3, price: 12.9, ...common }
      },
      commodities: {
        gold: { trend: "down", changePct: -2.8, priceLabel: "跌破观察区", ...common },
        antimony: { trend: "down", changePct: -4.1, priceLabel: "连续回落", ...common },
        tungsten: { trend: "down", changePct: -3.7, priceLabel: "高位失守", ...common },
        minorMetals: { trend: "down", changePct: -4.6, priceLabel: "板块退潮", ...common }
      },
      marginHeat: {
        "hunan-gold": { stockId: "hunan-gold", heat: "hot", balanceChangePct: 6.6, ...common },
        "china-tungsten": { stockId: "china-tungsten", heat: "hot", balanceChangePct: 7.3, ...common }
      },
      announcements: [
        { id: "mock-negative-hg", stockId: "hunan-gold", title: "模拟：重组进展暂无新增确认", tone: "neutral", publishedAt: updatedAt, ...common }
      ]
    }
  };

  const preset = presets[scenarioId] ?? {
    quotes: coolingQuotes,
    commodities: coolingCommodities,
    marginHeat: coolingMargin,
    news: [
      { id: "mock-resource-cooling", relatedTo: "portfolio", title: "模拟：资源线整体降温", tone: "negative", publishedAt: updatedAt, ...common }
    ]
  };

  return {
    source: "mock",
    updatedAt,
    providerStatus: [providerStatus("mock", "本地模拟", "ok", updatedAt)],
    quotes: ensureQuoteRecords(portfolioHoldings, preset.quotes, scenarioId, common),
    commodities: preset.commodities,
    announcements: preset.announcements ?? [],
    news: preset.news ?? [],
    marginHeat: ensureMarginRecords(portfolioHoldings, preset.marginHeat, scenarioId, common)
  };
}

function buildUnavailableRealSnapshot(portfolioHoldings: Holding[], cachedSnapshot?: MarketSnapshot): MarketSnapshot {
  const now = new Date().toISOString();
  const fallback = cachedSnapshot ?? mockSnapshotForScenario("cooling", new Date(), portfolioHoldings);
  const message = cachedSnapshot ? "真实数据接口尚未配置，当前显示上次缓存快照。" : "真实数据接口尚未配置，当前使用本地模拟兜底。";

  return {
    ...fallback,
    stale: true,
    providerStatus: [
      providerStatus("quote", "行情接口", "disabled", now, "未配置稳定真实行情 provider"),
      providerStatus("commodity", "商品价格", "disabled", now, "未配置稳定商品价格 provider"),
      providerStatus("news", "公告/新闻", "disabled", now, "未配置稳定公告新闻 provider"),
      providerStatus("margin", "两融热度", "disabled", now, "未配置稳定两融 provider")
    ],
    errors: [message]
  };
}

async function buildRealSnapshot(portfolioHoldings: Holding[], cachedSnapshot?: MarketSnapshot, client?: RealMarketDataClient): Promise<MarketSnapshot> {
  if (!client) return buildUnavailableRealSnapshot(portfolioHoldings, cachedSnapshot);

  const fallback = cachedSnapshot ?? mockSnapshotForScenario("cooling", new Date(), portfolioHoldings);
  try {
    const quotes = await client.fetchQuotes(portfolioHoldings.map((holding) => holding.code).filter(Boolean));
    if (!quotes.length) return buildUnavailableRealSnapshot(portfolioHoldings, fallback);
    return mergeRealQuotesIntoSnapshot(fallback, portfolioHoldings, quotes);
  } catch (error) {
    const snapshot = buildUnavailableRealSnapshot(portfolioHoldings, fallback);
    return {
      ...snapshot,
      providerStatus: snapshot.providerStatus?.map((status) =>
        status.id === "quote"
          ? { ...status, status: "error", message: error instanceof Error ? error.message : "真实行情接口请求失败" }
          : status
      ),
      errors: [error instanceof Error ? error.message : "真实行情接口请求失败"]
    };
  }
}

function ensureQuoteRecords(portfolioHoldings: Holding[], known: Record<StockId, QuotePoint>, scenarioId: string, common: Pick<QuotePoint, "source" | "updatedAt">): Record<StockId, QuotePoint> {
  return Object.fromEntries(portfolioHoldings.map((holding) => [holding.id, known[holding.id] ?? genericQuote(scenarioId, common)]));
}

function ensureMarginRecords(
  portfolioHoldings: Holding[],
  known: Record<StockId, MarginHeatPoint>,
  scenarioId: string,
  common: Pick<MarginHeatPoint, "source" | "updatedAt">
): Record<StockId, MarginHeatPoint> {
  return Object.fromEntries(portfolioHoldings.map((holding) => [holding.id, known[holding.id] ?? genericMargin(holding.id, scenarioId, common)]));
}

function genericQuote(scenarioId: string, common: Pick<QuotePoint, "source" | "updatedAt">): QuotePoint {
  if (scenarioId === "overheated") return { changePct: 3.2, turnoverRate: 8.6, ...common };
  if (scenarioId === "red-risk") return { changePct: -3.5, turnoverRate: 7.8, ...common };
  if (scenarioId === "normal") return { changePct: 0.6, turnoverRate: 2.8, ...common };
  return { changePct: -0.8, turnoverRate: 3.2, ...common };
}

function genericMargin(stockId: StockId, scenarioId: string, common: Pick<MarginHeatPoint, "source" | "updatedAt">): MarginHeatPoint {
  const heat = scenarioId === "overheated" || scenarioId === "red-risk" ? "hot" : "normal";
  return { stockId, heat, balanceChangePct: heat === "hot" ? 5.2 : 0.6, ...common };
}

function configuredStockIds(portfolioHoldings: Holding[], input: ManualDataInput): StockId[] {
  return Array.from(
    new Set([
      ...portfolioHoldings.map((holding) => holding.id),
      ...Object.keys(input.quotes ?? {}),
      ...Object.keys(input.marginHeat ?? {})
    ])
  );
}

function manualQuote(stockId: StockId, input: ManualDataInput, timestamp: string): QuotePoint {
  return {
    changePct: 0,
    turnoverRate: 0,
    price: undefined,
    ...input.quotes?.[stockId],
    source: "manual",
    updatedAt: timestamp
  };
}

function manualMargin(stockId: StockId, input: ManualDataInput, timestamp: string): MarginHeatPoint {
  return {
    stockId,
    heat: "normal",
    balanceChangePct: 0,
    ...input.marginHeat?.[stockId],
    source: "manual",
    updatedAt: timestamp
  };
}

function mergeRecord<T>(base: Record<StockId, T>, override: Record<StockId, T>): Record<StockId, T> {
  const ids = new Set([...Object.keys(base), ...Object.keys(override)]);
  return Object.fromEntries([...ids].map((id) => [id, { ...base[id], ...override[id] }]));
}

function providerStatus(id: string, label: string, status: SnapshotProviderStatus["status"], updatedAt: string, message?: string): SnapshotProviderStatus {
  return { id, label, status, updatedAt, message };
}

export const emptyManualInput: ManualDataInput = {
  quotes: Object.fromEntries(defaultHoldings.map((holding) => [holding.id, {}])) as ManualDataInput["quotes"],
  commodities: {},
  marginHeat: Object.fromEntries(defaultHoldings.map((holding) => [holding.id, {}])) as ManualDataInput["marginHeat"],
  announcements: [],
  news: []
};
