export type StockId = string;

export type SignalStatus = "green" | "yellow" | "red";

export type StockStatus = "green" | "yellow" | "red" | "overheated" | "watch";

export type AlertSeverity = "silent" | "light" | "medium" | "strong";

export type DataProviderMode = "mock" | "manual" | "mock+manual" | "real";

export type ProviderStatusState = "ok" | "stale" | "error" | "disabled";

export type Trend = "up" | "flat" | "down";

export interface Signal {
  id: string;
  label: string;
  status: SignalStatus;
  value: string;
  note: string;
  weight: number;
}

export interface Holding {
  id: StockId;
  name: string;
  code: string;
  positionRatio: number;
  costNote: string;
  thesis: string;
  horizon: "中线" | "长期" | "观察";
}

export interface SnapshotProviderStatus {
  id: string;
  label: string;
  status: ProviderStatusState;
  updatedAt?: string;
  message?: string;
}

export interface StockProfile {
  holding: Holding;
  signals: Signal[];
  score: number;
  status: StockStatus;
  headline: string;
  reasons: string[];
  nextWatch: string[];
}

export interface PetAlert {
  id: string;
  eventKey?: string;
  stockId?: StockId;
  title: string;
  severity: AlertSeverity;
  summary: string;
  whyNow: string;
  reasons: string[];
  interpretation: string;
  nextWatch: string[];
  createdAt: string;
  createdAtMs?: number;
}

export interface UserPreferences {
  redOnly: boolean;
  quietMode: boolean;
  sensitivity: "low" | "balanced" | "high";
  feedbackCounts: {
    useful: number;
    tooFrequent: number;
    notImportant: number;
    tooComplex: number;
  };
}

export interface Scenario {
  id: string;
  label: string;
  description: string;
  signalOverrides: Partial<Record<StockId, Record<string, SignalStatus>>>;
}

export interface QuotePoint {
  name?: string;
  changePct?: number;
  turnoverRate?: number;
  price?: number;
  source: DataProviderMode | "manual" | "mock";
  updatedAt: string;
}

export interface RealQuotePoint {
  code: string;
  name: string;
  price?: number;
  changePct?: number;
  turnoverRate?: number;
  updatedAt: string;
}

export interface CommodityPoint {
  trend: Trend;
  changePct?: number;
  priceLabel?: string;
  source: DataProviderMode | "manual" | "mock";
  updatedAt: string;
}

export interface AnnouncementItem {
  id: string;
  stockId: StockId;
  title: string;
  tone: "positive" | "neutral" | "negative";
  source: DataProviderMode | "manual" | "mock";
  publishedAt: string;
}

export interface NewsItem {
  id: string;
  relatedTo: StockId | "portfolio";
  title: string;
  tone: "positive" | "neutral" | "negative";
  source: DataProviderMode | "manual" | "mock";
  publishedAt: string;
}

export interface MarginHeatPoint {
  stockId: StockId;
  heat: "cool" | "normal" | "hot";
  balanceChangePct?: number;
  source: DataProviderMode | "manual" | "mock";
  updatedAt: string;
}

export interface MarketSnapshot {
  source: DataProviderMode;
  updatedAt: string;
  stale?: boolean;
  errors?: string[];
  providerStatus?: SnapshotProviderStatus[];
  quotes: Record<StockId, QuotePoint>;
  commodities: {
    gold: CommodityPoint;
    antimony: CommodityPoint;
    tungsten: CommodityPoint;
    minorMetals: CommodityPoint;
  };
  announcements: AnnouncementItem[];
  news: NewsItem[];
  marginHeat: Record<StockId, MarginHeatPoint>;
}

export interface ManualDataInput {
  quotes?: Partial<Record<StockId, Partial<Omit<QuotePoint, "source" | "updatedAt">>>>;
  commodities?: Partial<Record<keyof MarketSnapshot["commodities"], Partial<Omit<CommodityPoint, "source" | "updatedAt">>>>;
  announcements?: AnnouncementItem[];
  news?: NewsItem[];
  marginHeat?: Partial<Record<StockId, Partial<Omit<MarginHeatPoint, "stockId" | "source" | "updatedAt">>>>;
}
