import { seedAlerts } from "./mockData";
import { portfolioMood } from "./scoring";
import type { AlertSeverity, MarketSnapshot, PetAlert, StockProfile, StockStatus, UserPreferences } from "./types";

interface BuildEventAlertsOptions {
  profiles: StockProfile[];
  snapshot: MarketSnapshot;
  preferences: UserPreferences;
  history: PetAlert[];
  now?: Date;
}

export interface AlertDiagnostics {
  readyAlerts: PetAlert[];
  coolingAlerts: Array<{ alert: PetAlert; remainingMinutes: number }>;
  mutedAlerts: PetAlert[];
  nextLine: string;
}

const baseCooldownMinutes: Record<AlertSeverity, number> = {
  silent: 0,
  light: 180,
  medium: 120,
  strong: 45
};

export function buildEventAlerts({ profiles, snapshot, preferences, history, now = new Date() }: BuildEventAlertsOptions): PetAlert[] {
  return buildAlertDiagnostics({ profiles, snapshot, preferences, history, now }).readyAlerts;
}

export function buildAlertDiagnostics({ profiles, snapshot, preferences, history, now = new Date() }: BuildEventAlertsOptions): AlertDiagnostics {
  const rawAlerts = [
    ...buildPortfolioAlerts(profiles, snapshot, now),
    ...profiles.flatMap((profile) => buildStockAlerts(profile, snapshot, now))
  ].filter((alert) => alert.severity !== "silent");

  const readyAlerts: PetAlert[] = [];
  const coolingAlerts: Array<{ alert: PetAlert; remainingMinutes: number }> = [];
  const mutedAlerts: PetAlert[] = [];

  for (const alert of rawAlerts) {
    if (!passesPreferenceGate(alert, preferences)) {
      mutedAlerts.push(alert);
      continue;
    }

    const remainingMinutes = cooldownRemainingMinutes(alert, history, preferences, now);
    if (remainingMinutes > 0) {
      coolingAlerts.push({ alert, remainingMinutes });
      continue;
    }

    readyAlerts.push(alert);
  }

  readyAlerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  coolingAlerts.sort((a, b) => a.remainingMinutes - b.remainingMinutes);

  return {
    readyAlerts,
    coolingAlerts,
    mutedAlerts,
    nextLine: buildDiagnosticLine(readyAlerts, coolingAlerts, mutedAlerts, preferences)
  };
}

export function buildDisplayedAlerts(options: BuildEventAlertsOptions): PetAlert[] {
  const events = buildEventAlerts(options);
  return [...events, ...seedAlerts].slice(0, 8);
}

function buildPortfolioAlerts(profiles: StockProfile[], snapshot: MarketSnapshot, now: Date): PetAlert[] {
  const alerts: PetAlert[] = [];
  const mood = portfolioMood(profiles);
  const concentration = profiles.reduce((sum, profile) => sum + profile.holding.positionRatio, 0);
  const redCount = profiles.filter((profile) => profile.status === "red").length;
  const topHoldings = [...profiles].sort((a, b) => b.holding.positionRatio - a.holding.positionRatio).slice(0, 3);
  const holdingSummary = topHoldings.map((profile) => `${profile.holding.name}约 ${profile.holding.positionRatio}%`).join("，");
  const bothResourceCooling =
    snapshot.commodities.gold.trend === "down" &&
    snapshot.commodities.tungsten.trend === "down" &&
    snapshot.commodities.minorMetals.trend === "down";

  if (concentration >= 85 && (mood === "red" || mood === "yellow" || bothResourceCooling)) {
    alerts.push({
      id: `portfolio-concentration-${dayKey(now)}`,
      eventKey: "portfolio-concentration",
      title: redCount >= 2 ? "组合红灯：资源线风险共振" : "组合黄灯：资源仓位过于集中",
      severity: redCount >= 2 ? "strong" : "medium",
      summary: redCount >= 2 ? "两只资源持仓同时转弱，组合层面需要复核。" : "资源仓位接近满仓，商品和板块同向波动会放大净值起伏。",
      whyNow: bothResourceCooling ? "金价、钨价和小金属板块同步降温，集中持仓的波动风险升温。" : "持仓集中度偏高，当前风险灯不是单只股票事件。",
      reasons: [
        holdingSummary ? `${holdingSummary}，合计仓位约 ${concentration}%` : `持仓合计约 ${concentration}%`,
        "主要仓位受商品价格、板块情绪、公告和资金热度共同影响",
        "用户不适合短线，因此提醒重点是复核逻辑而不是追涨杀跌"
      ],
      interpretation: "这是组合结构提醒，不构成买卖建议。它说明需要检查原本的中线假设是否仍成立，并留意现金缓冲是否足够。",
      nextWatch: ["商品价格是否继续同向回落", "两融/成交热度是否继续升高", "公司公告是否改变原有持仓逻辑"],
      createdAt: formatTime(now),
      createdAtMs: now.getTime()
    });
  }

  return alerts;
}

function buildStockAlerts(profile: StockProfile, snapshot: MarketSnapshot, now: Date): PetAlert[] {
  const severity = alertSeverityForStatus(profile.status);
  if (severity === "silent") return [];

  const hotMargin = snapshot.marginHeat[profile.holding.id]?.heat === "hot";
  const whyNow = buildWhyNow(profile.status, hotMargin, profile.reasons);

  return [
    {
      id: `${profile.holding.id}-${profile.status}-${dayKey(now)}`,
      eventKey: `${profile.holding.id}-${profile.status}`,
      stockId: profile.holding.id,
      title: `${profile.holding.name}${statusAlertTitle(profile.status)}`,
      severity,
      summary: profile.headline,
      whyNow,
      reasons: profile.reasons.length ? profile.reasons : ["当前没有明显风险共振，继续观察固定公式即可。"],
      interpretation: interpretationFor(profile.status),
      nextWatch: profile.nextWatch,
      createdAt: formatTime(now),
      createdAtMs: now.getTime()
    }
  ];
}

function passesPreferenceGate(alert: PetAlert, preferences: UserPreferences): boolean {
  if (preferences.quietMode || preferences.redOnly) return alert.severity === "strong";
  if (preferences.feedbackCounts.tooFrequent >= 3 && alert.severity !== "strong") return false;
  if (preferences.sensitivity === "low") return alert.severity !== "light";
  if (preferences.sensitivity === "high") return true;
  return true;
}

function isCoolingDown(alert: PetAlert, history: PetAlert[], preferences: UserPreferences, now: Date): boolean {
  return cooldownRemainingMinutes(alert, history, preferences, now) > 0;
}

function cooldownRemainingMinutes(alert: PetAlert, history: PetAlert[], preferences: UserPreferences, now: Date): number {
  const sameEvent = history
    .filter((item) => (item.eventKey ?? item.id) === (alert.eventKey ?? alert.id))
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))[0];

  if (!sameEvent?.createdAtMs) return 0;
  const feedbackPenalty = preferences.feedbackCounts.tooFrequent * 20;
  const usefulDiscount = Math.min(preferences.feedbackCounts.useful * 10, 30);
  const cooldownMinutes = Math.max(30, baseCooldownMinutes[alert.severity] + feedbackPenalty - usefulDiscount);
  const remainingMs = cooldownMinutes * 60_000 - (now.getTime() - sameEvent.createdAtMs);
  return Math.max(0, Math.ceil(remainingMs / 60_000));
}

function alertSeverityForStatus(status: StockStatus): AlertSeverity {
  if (status === "red") return "strong";
  if (status === "overheated") return "medium";
  if (status === "yellow") return "light";
  return "silent";
}

function statusAlertTitle(status: StockStatus): string {
  if (status === "red") return "进入红灯";
  if (status === "overheated") return "资金过热";
  if (status === "yellow") return "进入黄灯";
  return "状态更新";
}

function interpretationFor(status: StockStatus): string {
  if (status === "red") return "多个核心变量同时转弱，今天不是普通噪音，需要严肃复核持仓逻辑。";
  if (status === "overheated") return "产业逻辑未必变坏，但资金太拥挤，短线波动会明显放大。";
  if (status === "yellow") return "短期压力升高，但还没有看到中线逻辑被破坏。";
  return "状态稳定，继续观察核心变量即可。";
}

function buildWhyNow(status: StockStatus, hotMargin: boolean, reasons: string[]): string {
  if (status === "red") return `触发红灯：${reasons[0] ?? "核心变量同步转弱"}。`;
  if (status === "overheated") return hotMargin ? "融资/成交热度升温，提醒你别被热度带着跑。" : "价格逻辑仍在，但波动温度升高。";
  return `风险升温但未破坏中线逻辑：${reasons[0] ?? "固定公式出现黄灯"}。`;
}

function severityRank(severity: AlertSeverity): number {
  if (severity === "strong") return 3;
  if (severity === "medium") return 2;
  if (severity === "light") return 1;
  return 0;
}

function buildDiagnosticLine(
  readyAlerts: PetAlert[],
  coolingAlerts: Array<{ alert: PetAlert; remainingMinutes: number }>,
  mutedAlerts: PetAlert[],
  preferences: UserPreferences
): string {
  if (readyAlerts[0]) return `现在提醒：${readyAlerts[0].whyNow}`;
  if (coolingAlerts[0]) return `保持安静：${coolingAlerts[0].alert.title} 仍在冷却，约 ${coolingAlerts[0].remainingMinutes} 分钟后再观察。`;
  if (mutedAlerts.length && (preferences.quietMode || preferences.redOnly)) return "保持安静：当前设置只让红灯或强提醒打扰你。";
  if (mutedAlerts.length) return "保持安静：反馈已降低非关键提醒频率。";
  return "保持观察：固定公式没有触发新的风险提醒。";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
