import { holdings as initialHoldings } from "./mockData";
import { getBrowserMarketDataClient, mergeRealQuotesIntoSnapshot, type RealMarketDataClient } from "./realMarketData";
import type { DataProviderMode, Holding, ManualDataInput, MarketSnapshot, MarginHeatPoint, QuotePoint, Scenario, SnapshotProviderStatus, StockId } from "./types";

export interface MarketDataProvider {
  id: DataProviderMode | string;
  label: string;
  getSnapshot: () => Promise<MarketSnapshot>;
}

type CommoditySnapshot = MarketSnapshot["commodities"];

export function createMockMarketDataProvider(scenarioId = "cooling", portfolioHoldings: Holding[] = initialHoldings): MarketDataProvider {
  return {
    id: "mock",
    label: "本地模拟数据",
    getSnapshot: async () => mockSnapshotForScenario(scenarioId, new Date(), portfolioHoldings)
  };
}

export function createManualMarketDataProvider(input: ManualDataInput, portfolioHoldings: Holding[] = initialHoldings): MarketDataProvider {
  return {
    id: "manual",
    label: "手动录入数据",
    getSnapshot: async () => buildManualSnapshot(input, new Date(), portfolioHoldings)
  };
}

export function createRealMarketDataProvider(
  portfolioHoldings: Holding[] = initialHoldings,
  cachedSnapshot?: MarketSnapshot,
  client: RealMarketDataClient | undefined = getBrowserMarketDataClient()
): MarketDataProvider {
  return {
    id: "real",
    label: "真实数据接口",
    getSnapshot: async () => buildRealSnapshot(portfolioHoldings, cachedSnapshot, client)
  };
}

export function buildManualSnapshot(input: ManualDataInput, now = new Date(), portfolioHoldings: Holding[] = initialHoldings): MarketSnapshot {
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
  portfolioHoldings: Holding[] = initialHoldings,
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

function mockSnapshotForScenario(scenarioId: string, now = new Date(), portfolioHoldings: Holding[] = initialHoldings): MarketSnapshot {
  const updatedAt = now.toISOString();
  const common = {
    source: "mock" as const,
    updatedAt
  };
  const preset = scenarioPreset(scenarioId, common);

  return {
    source: "mock",
    updatedAt,
    providerStatus: [providerStatus("mock", "本地模拟", "ok", updatedAt)],
    quotes: Object.fromEntries(portfolioHoldings.map((holding) => [holding.id, genericQuote(scenarioId, common)])),
    commodities: preset.commodities,
    announcements: preset.announcements ?? [],
    news: preset.news ?? [],
    marginHeat: Object.fromEntries(portfolioHoldings.map((holding) => [holding.id, genericMargin(holding.id, scenarioId, common)]))
  };
}

function scenarioPreset(
  scenarioId: string,
  common: Pick<QuotePoint, "source" | "updatedAt">
): { commodities: CommoditySnapshot; announcements?: MarketSnapshot["announcements"]; news?: MarketSnapshot["news"] } {
  if (scenarioId === "normal") {
    return {
      commodities: {
        gold: { trend: "flat", changePct: 0.2, priceLabel: "温和震荡", ...common },
        antimony: { trend: "flat", changePct: 0.1, priceLabel: "温和震荡", ...common },
        tungsten: { trend: "flat", changePct: 0.2, priceLabel: "温和震荡", ...common },
        minorMetals: { trend: "flat", changePct: 0.2, priceLabel: "分化企稳", ...common }
      }
    };
  }

  if (scenarioId === "overheated") {
    return {
      commodities: {
        gold: { trend: "up", changePct: 1.1, priceLabel: "偏强", ...common },
        antimony: { trend: "up", changePct: 1.2, priceLabel: "偏强", ...common },
        tungsten: { trend: "up", changePct: 1.2, priceLabel: "偏强", ...common },
        minorMetals: { trend: "up", changePct: 2.0, priceLabel: "情绪升温", ...common }
      }
    };
  }

  if (scenarioId === "red-risk") {
    return {
      commodities: {
        gold: { trend: "down", changePct: -2.8, priceLabel: "回落", ...common },
        antimony: { trend: "down", changePct: -3.1, priceLabel: "回落", ...common },
        tungsten: { trend: "down", changePct: -3.0, priceLabel: "回落", ...common },
        minorMetals: { trend: "down", changePct: -4.0, priceLabel: "板块降温", ...common }
      },
      news: [{ id: "mock-portfolio-risk", relatedTo: "portfolio", title: "模拟：组合相关板块整体降温", tone: "negative", publishedAt: common.updatedAt, ...common }]
    };
  }

  return {
    commodities: {
      gold: { trend: "down", changePct: -1.1, priceLabel: "短线承压", ...common },
      antimony: { trend: "down", changePct: -1.4, priceLabel: "短线承压", ...common },
      tungsten: { trend: "flat", changePct: -0.4, priceLabel: "横盘", ...common },
      minorMetals: { trend: "down", changePct: -2.2, priceLabel: "板块调整", ...common }
    },
    news: [{ id: "mock-portfolio-cooling", relatedTo: "portfolio", title: "模拟：组合相关板块降温", tone: "negative", publishedAt: common.updatedAt, ...common }]
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

function genericQuote(scenarioId: string, common: Pick<QuotePoint, "source" | "updatedAt">): QuotePoint {
  if (scenarioId === "overheated") return { changePct: 3.2, turnoverRate: 8.6, ...common };
  if (scenarioId === "red-risk") return { changePct: -4.2, turnoverRate: 8.8, ...common };
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
  quotes: Object.fromEntries(initialHoldings.map((holding) => [holding.id, {}])) as ManualDataInput["quotes"],
  commodities: {},
  marginHeat: Object.fromEntries(initialHoldings.map((holding) => [holding.id, {}])) as ManualDataInput["marginHeat"],
  announcements: [],
  news: []
};
