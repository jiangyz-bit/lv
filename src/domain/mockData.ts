import type { Holding, PetAlert, Scenario, Signal, StockId, UserPreferences } from "./types";

export const holdings: Holding[] = [];

export const baseSignals: Record<StockId, Signal[]> = {};

export const scenarios: Scenario[] = [
  {
    id: "cooling",
    label: "组合降温",
    description: "默认演示：价格和资金热度回落，用通用观察公式检查风险。",
    signalOverrides: {}
  },
  {
    id: "normal",
    label: "逻辑稳定",
    description: "价格波动温和，资金热度可控。",
    signalOverrides: {}
  },
  {
    id: "overheated",
    label: "资金过热",
    description: "价格较强但成交和融资热度偏高。",
    signalOverrides: {}
  },
  {
    id: "red-risk",
    label: "红灯风控",
    description: "价格、公告或资金面触发通用风险复核。",
    signalOverrides: {}
  }
];

export const defaultPreferences: UserPreferences = {
  redOnly: false,
  quietMode: false,
  sensitivity: "balanced",
  feedbackCounts: {
    useful: 0,
    tooFrequent: 0,
    notImportant: 0,
    tooComplex: 0
  }
};

export const seedAlerts: PetAlert[] = [
  {
    id: "portfolio-concentration-risk",
    eventKey: "portfolio-concentration",
    title: "组合集中度需要定期复核",
    severity: "light",
    summary: "固定公式会观察仓位集中度、价格波动、公告和资金热度。",
    whyNow: "这是默认陪伴提醒，用于保持中线观察框架，而不是给出买卖指令。",
    reasons: ["关注单一仓位是否过高", "关注成交和融资热度是否同步升温", "关注公告是否改变原持仓逻辑"],
    interpretation: "这是组合结构提醒，不是短线交易信号，也不构成收益承诺。",
    nextWatch: ["价格和换手是否同步放大", "公告是否改变原持仓逻辑", "组合集中度是否继续升高"],
    createdAt: "今天",
    createdAtMs: Date.now()
  }
];
