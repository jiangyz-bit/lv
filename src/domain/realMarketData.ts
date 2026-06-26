import type { Holding, MarketSnapshot, RealQuotePoint, SnapshotProviderStatus, StockId } from "./types";

const EASTMONEY_QUOTE_ENDPOINT = "https://push2.eastmoney.com/api/qt/ulist.np/get";

export interface RealMarketDataClient {
  fetchQuotes: (codes: string[]) => Promise<RealQuotePoint[]>;
}

export function getBrowserMarketDataClient(): RealMarketDataClient | undefined {
  return globalThis.window?.marketData;
}

export function eastmoneySecidForCode(code: string): string | undefined {
  const normalized = normalizeStockCode(code);
  if (!/^\d{6}$/.test(normalized)) return undefined;
  const market = normalized.startsWith("5") || normalized.startsWith("6") || normalized.startsWith("9") ? "1" : "0";
  return `${market}.${normalized}`;
}

export function buildEastmoneyQuoteUrl(codes: string[]): string {
  const secids = codes.map(eastmoneySecidForCode).filter(Boolean).join(",");
  const params = new URLSearchParams({
    fltt: "2",
    invt: "2",
    fields: "f12,f14,f2,f3,f8,f18",
    secids
  });
  return `${EASTMONEY_QUOTE_ENDPOINT}?${params.toString()}`;
}

export function mergeRealQuotesIntoSnapshot(base: MarketSnapshot, portfolioHoldings: Holding[], quotes: RealQuotePoint[], now = new Date()): MarketSnapshot {
  const updatedAt = now.toISOString();
  const quoteByCode = new Map(quotes.map((quote) => [normalizeStockCode(quote.code), quote]));
  const missingCodes = portfolioHoldings
    .map((holding) => normalizeStockCode(holding.code))
    .filter((code) => code && !quoteByCode.has(code));

  return {
    ...base,
    source: "real",
    stale: false,
    updatedAt,
    providerStatus: [
      providerStatus(
        "quote",
        "公开行情",
        missingCodes.length ? "stale" : "ok",
        updatedAt,
        missingCodes.length ? `部分代码未返回行情：${missingCodes.join("，")}` : "已获取实时行情、名称、现价和涨跌幅"
      ),
      providerStatus("commodity", "商品价格", "disabled", updatedAt, "商品价格 provider 尚未接入"),
      providerStatus("news", "公告/新闻", "disabled", updatedAt, "公告/新闻 provider 尚未接入"),
      providerStatus("margin", "两融热度", "disabled", updatedAt, "两融热度 provider 尚未接入")
    ],
    errors: missingCodes.length ? [`部分代码未返回行情：${missingCodes.join("，")}`] : [],
    quotes: {
      ...base.quotes,
      ...Object.fromEntries(portfolioHoldings.map((holding) => [holding.id, mergeQuoteForHolding(base, holding, quoteByCode, updatedAt)]))
    }
  };
}

function mergeQuoteForHolding(base: MarketSnapshot, holding: Holding, quoteByCode: Map<string, RealQuotePoint>, updatedAt: string) {
  const quote = quoteByCode.get(normalizeStockCode(holding.code));
  if (!quote) return base.quotes[holding.id] ?? { source: "real" as const, updatedAt };
  return {
    ...base.quotes[holding.id],
    name: quote.name,
    price: quote.price,
    changePct: quote.changePct,
    turnoverRate: quote.turnoverRate,
    source: "real" as const,
    updatedAt: quote.updatedAt || updatedAt
  };
}

function providerStatus(id: string, label: string, status: SnapshotProviderStatus["status"], updatedAt: string, message?: string): SnapshotProviderStatus {
  return { id, label, status, updatedAt, message };
}

function normalizeStockCode(code: string): string {
  return code.trim().toUpperCase().replace(/^S[HZ]/, "");
}
