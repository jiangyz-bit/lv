import type { Holding, PetAlert, Scenario, Signal, StockId, UserPreferences } from "./types";

export const holdings: Holding[] = [
  {
    id: "hunan-gold",
    name: "湖南黄金",
    code: "002155",
    positionRatio: 59,
    costNote: "低点买入 5000 股",
    thesis: "黄金避险 + 锑资源稀缺 + 重组预期",
    horizon: "中线"
  },
  {
    id: "china-tungsten",
    name: "中钨高新",
    code: "000657",
    positionRatio: 40,
    costNote: "资源仓核心持有",
    thesis: "钨资源 + 硬质合金 + PCB 微钻/AI 服务器链",
    horizon: "中线"
  }
];

export const baseSignals: Record<StockId, Signal[]> = {
  "hunan-gold": [
    { id: "gold", label: "金价", status: "yellow", value: "等待数据", note: "黄金方向影响避险和资源弹性", weight: 25 },
    { id: "antimony", label: "锑价", status: "yellow", value: "等待数据", note: "锑价是利润弹性的关键观察项", weight: 20 },
    { id: "restructure", label: "重组", status: "green", value: "未见受阻公告", note: "重组预期仍是持仓逻辑的一部分", weight: 15 },
    { id: "sector", label: "板块", status: "yellow", value: "资源线分化", note: "资源股同向波动会放大组合净值波动", weight: 15 },
    { id: "funds", label: "资金", status: "yellow", value: "观察量能", note: "强势股回撤时资金拥挤会放大波动", weight: 10 },
    { id: "macro", label: "美元/美债", status: "yellow", value: "观察压制", note: "高利率预期会压制黄金估值", weight: 10 },
    { id: "technical", label: "技术", status: "yellow", value: "等待缩量企稳", note: "中线持仓只看是否出现连续破位", weight: 5 }
  ],
  "china-tungsten": [
    { id: "tungsten", label: "钨价", status: "yellow", value: "等待数据", note: "钨价能否守住高位是核心变量", weight: 30 },
    { id: "alloy", label: "硬质合金", status: "green", value: "需求正常", note: "公司加工链逻辑未破坏", weight: 20 },
    { id: "ai-pcb", label: "AI链", status: "green", value: "PCB 微钻受益", note: "AI 服务器链仍有景气观察价值", weight: 15 },
    { id: "earnings", label: "业绩", status: "green", value: "等待季报验证", note: "量价齐升需要后续业绩兑现", weight: 15 },
    { id: "minor-metals", label: "小金属", status: "yellow", value: "板块分化", note: "强势资源股补跌会拖累情绪", weight: 10 },
    { id: "crowding", label: "融资", status: "yellow", value: "观察热度", note: "融资盘偏高时波动会放大", weight: 10 }
  ]
};

export const scenarios: Scenario[] = [
  {
    id: "cooling",
    label: "资源降温",
    description: "默认演示：商品价格承压，板块退潮，但中线逻辑未被破坏。",
    signalOverrides: {}
  },
  {
    id: "normal",
    label: "逻辑稳定",
    description: "核心商品价格止跌，板块情绪恢复。",
    signalOverrides: {
      "hunan-gold": { gold: "green", antimony: "green", sector: "yellow", funds: "green", macro: "yellow", technical: "green" },
      "china-tungsten": { tungsten: "green", "minor-metals": "yellow", crowding: "yellow" }
    }
  },
  {
    id: "overheated",
    label: "资金过热",
    description: "逻辑仍强，但融资和成交太拥挤。",
    signalOverrides: {
      "hunan-gold": { gold: "green", antimony: "green", sector: "green", funds: "red", technical: "red" },
      "china-tungsten": { tungsten: "green", "ai-pcb": "green", "minor-metals": "green", crowding: "red" }
    }
  },
  {
    id: "red-risk",
    label: "红灯风控",
    description: "商品、板块和资金面同时转弱。",
    signalOverrides: {
      "hunan-gold": { gold: "red", antimony: "red", sector: "red", funds: "red", macro: "red", technical: "red" },
      "china-tungsten": { tungsten: "red", alloy: "yellow", "ai-pcb": "yellow", "minor-metals": "red", crowding: "red" }
    }
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
    id: "portfolio-resource-risk",
    eventKey: "portfolio-concentration",
    title: "组合资源仓位偏高",
    severity: "medium",
    summary: "湖南黄金和中钨高新同属资源周期线，同涨同跌风险较高。",
    whyNow: "持仓结构本身已经集中，适合长期放在观察清单顶部。",
    reasons: ["两只股票合计仓位接近满仓", "现金约 10 万，可作为波动缓冲", "重点观察商品价格和板块情绪是否同步走弱"],
    interpretation: "这是组合结构风险，不是单家公司暴雷，也不是买卖指令。中线逻辑还要继续看金价、锑价、钨价是否止跌。",
    nextWatch: ["金价能否重新站稳关键位", "钨价是否守住高位区间", "下跌时成交量是否缩小"],
    createdAt: "今天",
    createdAtMs: Date.now()
  }
];
