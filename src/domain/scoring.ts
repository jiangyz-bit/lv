import { baseSignals, holdings } from "./mockData";
import type { Holding, MarketSnapshot, MarginHeatPoint, QuotePoint, Scenario, Signal, SignalStatus, StockId, StockProfile, StockStatus, Trend } from "./types";

const statusScore: Record<SignalStatus, number> = {
  green: 1,
  yellow: 0,
  red: -1
};

export function applyScenario(stockId: StockId, scenario: Scenario): Signal[] {
  const overrides = scenario.signalOverrides[stockId] ?? {};
  return getBaseSignals(stockId).map((signal) => ({
    ...signal,
    status: overrides[signal.id] ?? signal.status
  }));
}

export function buildStockProfile(stockId: StockId, scenario: Scenario, portfolioHoldings: Holding[] = holdings): StockProfile {
  const holding = portfolioHoldings.find((item) => item.id === stockId) ?? createFallbackHolding(stockId);
  return buildProfileFromSignals(holding, applyScenario(stockId, scenario));
}

export function buildProfiles(scenario: Scenario, portfolioHoldings: Holding[] = holdings): StockProfile[] {
  return portfolioHoldings.map((holding) => buildStockProfile(holding.id, scenario, portfolioHoldings));
}

export function buildProfilesFromSnapshot(snapshot: MarketSnapshot, portfolioHoldings: Holding[] = holdings): StockProfile[] {
  return portfolioHoldings.map((holding) => buildProfileFromSignals(holding, signalsFromSnapshot(holding.id, snapshot, holding)));
}

export function signalsFromSnapshot(stockId: StockId, snapshot: MarketSnapshot, holding?: Holding): Signal[] {
  return getBaseSignals(stockId, holding).map((signal) => {
    if (stockId === "hunan-gold") return mapHunanGoldSignal(signal, snapshot);
    if (stockId === "china-tungsten") return mapChinaTungstenSignal(signal, snapshot);
    return mapGenericSignal(signal, stockId, snapshot, holding);
  });
}

function getBaseSignals(stockId: StockId, holding?: Holding): Signal[] {
  return baseSignals[stockId] ?? genericBaseSignals(holding);
}

function genericBaseSignals(holding?: Holding): Signal[] {
  const name = holding?.name ?? "自定义股票";
  return [
    { id: "price-action", label: "波动", status: "yellow", value: "等待数据", note: `${name}只观察涨跌幅与换手是否共振`, weight: 35 },
    { id: "liquidity", label: "热度", status: "yellow", value: "观察资金", note: "成交和融资热度升温时，波动可能放大", weight: 25 },
    { id: "announcement", label: "公告", status: "green", value: "未录入负面公告", note: "公告只用于复核原持仓逻辑是否变化", weight: 25 },
    { id: "portfolio-fit", label: "组合", status: "yellow", value: "检查仓位", note: "看它是否降低或加剧组合集中度", weight: 15 }
  ];
}

function mapHunanGoldSignal(signal: Signal, snapshot: MarketSnapshot): Signal {
  const quote = quoteFor(snapshot, "hunan-gold");
  const margin = marginFor(snapshot, "hunan-gold");
  const negativeAnnouncement = snapshot.announcements.some((item) => item.stockId === "hunan-gold" && item.tone === "negative");
  const negativePortfolioNews = snapshot.news.some((item) => item.relatedTo === "portfolio" && item.tone === "negative");

  if (signal.id === "gold") return withCommodity(signal, snapshot.commodities.gold, "金价");
  if (signal.id === "antimony") return withCommodity(signal, snapshot.commodities.antimony, "锑价");
  if (signal.id === "restructure") {
    return {
      ...signal,
      status: negativeAnnouncement ? "red" : "green",
      value: negativeAnnouncement ? "出现负面公告" : "未见受阻公告",
      note: negativeAnnouncement ? "需要复核重组预期是否改变" : "重组预期未被公告否定"
    };
  }
  if (signal.id === "sector") {
    return negativePortfolioNews
      ? { ...signal, status: "red", value: "组合新闻偏负面", note: "新闻/备忘提示资源线情绪承压，需要复核而不是追涨杀跌" }
      : withCommodity(signal, snapshot.commodities.minorMetals, "资源板块");
  }
  if (signal.id === "funds") return withQuotePressure(signal, quote.turnoverRate, margin.heat);
  if (signal.id === "macro") return snapshot.commodities.gold.trend === "up" ? { ...signal, status: "green", value: "黄金获得支撑", note: "宏观压力暂未压坏金价" } : signal;
  if (signal.id === "technical") return withQuoteMove(signal, quote.changePct, quote.turnoverRate);
  return signal;
}

function mapChinaTungstenSignal(signal: Signal, snapshot: MarketSnapshot): Signal {
  const quote = quoteFor(snapshot, "china-tungsten");
  const margin = marginFor(snapshot, "china-tungsten");
  const negativeAnnouncement = snapshot.announcements.some((item) => item.stockId === "china-tungsten" && item.tone === "negative");
  const negativePortfolioNews = snapshot.news.some((item) => item.relatedTo === "portfolio" && item.tone === "negative");

  if (signal.id === "tungsten") return withCommodity(signal, snapshot.commodities.tungsten, "钨价");
  if (signal.id === "minor-metals") {
    return negativePortfolioNews
      ? { ...signal, status: "red", value: "组合新闻偏负面", note: "新闻/备忘提示资源线情绪承压，需要复核组合集中度" }
      : withCommodity(signal, snapshot.commodities.minorMetals, "小金属");
  }
  if (signal.id === "crowding") return withQuotePressure(signal, quote.turnoverRate, margin.heat);
  if (signal.id === "earnings") {
    return negativeAnnouncement
      ? { ...signal, status: "red", value: "公告偏负面", note: "手动公告提示公司变量需要复核，先看原持仓逻辑是否仍成立" }
      : { ...signal, value: "等待业绩兑现", note: "不因单日涨跌改变业绩观察" };
  }
  return signal;
}

function mapGenericSignal(signal: Signal, stockId: StockId, snapshot: MarketSnapshot, holding?: Holding): Signal {
  const quote = quoteFor(snapshot, stockId);
  const margin = marginFor(snapshot, stockId);
  const announcement = snapshot.announcements.find((item) => item.stockId === stockId);

  if (signal.id === "price-action") return withQuoteMove(signal, quote.changePct, quote.turnoverRate);
  if (signal.id === "liquidity") return withQuotePressure(signal, quote.turnoverRate, margin.heat);
  if (signal.id === "announcement") {
    if (announcement?.tone === "negative") return { ...signal, status: "red", value: "公告偏负面", note: "先复核这条公告是否改变原持仓逻辑" };
    if (announcement?.tone === "positive") return { ...signal, status: "green", value: "公告偏正面", note: "只记录变量改善，不推导短线涨跌" };
    return { ...signal, status: "green", value: "未录入负面公告", note: "暂未看到会直接改变原假设的公告输入" };
  }
  if (signal.id === "portfolio-fit") {
    const ratio = holding?.positionRatio ?? 0;
    const status: SignalStatus = ratio >= 35 ? "red" : ratio >= 15 ? "yellow" : "green";
    return {
      ...signal,
      status,
      value: `仓位约 ${ratio}%`,
      note: status === "red" ? "单一仓位偏高，需要额外留意组合集中度" : "用于观察它对组合集中度的影响"
    };
  }
  return signal;
}

function withCommodity(signal: Signal, point: MarketSnapshot["commodities"]["gold"], label: string): Signal {
  return {
    ...signal,
    status: statusFromTrend(point.trend, point.changePct),
    value: point.priceLabel ?? `${formatPct(point.changePct)} ${trendText(point.trend)}`,
    note: `${label}${trendText(point.trend)}，来自${sourceLabel(point.source)}`
  };
}

function withQuotePressure(signal: Signal, turnoverRate = 0, heat: string): Signal {
  const hot = heat === "hot" || turnoverRate >= 10;
  const status: SignalStatus = hot ? "red" : turnoverRate >= 6 ? "yellow" : "green";
  return {
    ...signal,
    status,
    value: hot ? "拥挤偏高" : turnoverRate >= 6 ? "活跃偏高" : "热度正常",
    note: `换手约 ${turnoverRate.toFixed(1)}%，融资/资金热度${hot ? "偏热" : "可控"}`
  };
}

function withQuoteMove(signal: Signal, changePct = 0, turnoverRate = 0): Signal {
  const status: SignalStatus = changePct <= -4 && turnoverRate >= 8 ? "red" : changePct <= -2 ? "yellow" : "green";
  return {
    ...signal,
    status,
    value: `${formatPct(changePct)}，换手 ${turnoverRate.toFixed(1)}%`,
    note: status === "red" ? "放量下跌，适合复核持仓逻辑" : "仅作为波动观察，不预测次日涨跌"
  };
}

function buildProfileFromSignals(holding: Holding, signals: Signal[]): StockProfile {
  const score = Math.round(signals.reduce((sum, signal) => sum + statusScore[signal.status] * signal.weight, 0));
  const redSignals = signals.filter((signal) => signal.status === "red");
  const yellowSignals = signals.filter((signal) => signal.status === "yellow");
  const status = deriveStatus(holding.id, score, redSignals, signals);
  const reasons = [...redSignals, ...yellowSignals].slice(0, 4).map((signal) => `${signal.label}：${signal.note}`);

  return {
    holding,
    signals,
    score,
    status,
    headline: buildHeadline(holding.name, status, score),
    reasons,
    nextWatch: buildNextWatch(holding, status)
  };
}

function deriveStatus(stockId: StockId, score: number, redSignals: Signal[], signals: Signal[]): StockStatus {
  const redIds = new Set(redSignals.map((signal) => signal.id));

  if (stockId === "hunan-gold") {
    if (redIds.has("gold") && redIds.has("antimony") && redIds.has("sector")) return "red";
    if (redIds.has("funds") && redIds.has("technical") && score > 20) return "overheated";
  }

  if (stockId === "china-tungsten") {
    if (redIds.has("tungsten") && redIds.has("minor-metals") && redIds.has("crowding")) return "red";
    if (redIds.has("crowding") && signals.some((signal) => signal.id === "tungsten" && signal.status === "green")) return "overheated";
  }

  if (score >= 35) return "green";
  if (score <= -35) return "red";
  if (score <= 15) return "yellow";
  return "watch";
}

function buildHeadline(name: string, status: StockStatus, score: number): string {
  const stateText: Record<StockStatus, string> = {
    green: "逻辑健康",
    yellow: "短期承压",
    red: "风险共振",
    overheated: "资金过热",
    watch: "继续观察"
  };
  return `${name}${stateText[status]}，综合分 ${score}`;
}

function buildNextWatch(holding: Holding, status: StockStatus): string[] {
  if (holding.id === "hunan-gold") {
    return status === "red"
      ? ["金价是否重新站回关键区", "锑价是否停止连续下跌", "有色板块是否缩量企稳"]
      : ["金价方向", "锑价止跌信号", "重组公告进展"];
  }

  if (holding.id === "china-tungsten") {
    return status === "red"
      ? ["钨价是否守住关键区", "融资余额是否继续升高", "小金属板块是否止跌"]
      : ["钨精矿价格", "Q2/Q3 业绩兑现", "PCB 微钻需求变化"];
  }

  return [
    `${holding.name}公告是否改变原持仓逻辑`,
    "涨跌幅和换手是否同步放大",
    "该仓位是否让组合过度集中"
  ];
}

export function portfolioMood(profiles: StockProfile[]): StockStatus {
  if (profiles.some((profile) => profile.status === "red")) return profiles.every((profile) => profile.status === "red") ? "red" : "yellow";
  if (profiles.some((profile) => profile.status === "overheated")) return "overheated";
  if (profiles.some((profile) => profile.status === "yellow")) return "yellow";
  if (profiles.length && profiles.every((profile) => profile.status === "green")) return "green";
  return "watch";
}

function quoteFor(snapshot: MarketSnapshot, stockId: StockId): QuotePoint {
  return snapshot.quotes[stockId] ?? { changePct: 0, turnoverRate: 0, source: snapshot.source, updatedAt: snapshot.updatedAt };
}

function marginFor(snapshot: MarketSnapshot, stockId: StockId): MarginHeatPoint {
  return snapshot.marginHeat[stockId] ?? { stockId, heat: "normal", balanceChangePct: 0, source: snapshot.source, updatedAt: snapshot.updatedAt };
}

function statusFromTrend(trend: Trend, changePct = 0): SignalStatus {
  if (trend === "up" || changePct >= 1) return "green";
  if (trend === "down" && changePct <= -2.5) return "red";
  return "yellow";
}

function trendText(trend: Trend): string {
  if (trend === "up") return "上行";
  if (trend === "down") return "回落";
  return "横盘";
}

function sourceLabel(source: string): string {
  if (source.includes("manual")) return "手动录入";
  if (source.includes("real")) return "真实接口";
  return "模拟数据";
}

function formatPct(value?: number): string {
  if (typeof value !== "number") return "未填";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function createFallbackHolding(stockId: StockId): Holding {
  return {
    id: stockId,
    name: stockId,
    code: "",
    positionRatio: 0,
    costNote: "手动添加",
    thesis: "等待补充持仓逻辑",
    horizon: "观察"
  };
}
