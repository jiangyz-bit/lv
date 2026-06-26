import { Activity, BarChart3, BellRing, Clock3, Compass, Database, Gauge, Layers3, ShieldAlert } from "lucide-react";
import type { AlertDiagnostics } from "../domain/alertEngine";
import type { MarketSnapshot, PetAlert, StockProfile, StockStatus } from "../domain/types";
import StockCard from "./StockCard";

interface PortfolioPanelProps {
  mood: StockStatus;
  profiles: StockProfile[];
  alerts: PetAlert[];
  diagnostics: AlertDiagnostics | undefined;
  snapshot: MarketSnapshot | undefined;
  onSelectStock: (profile: StockProfile) => void;
  onSelectAlert: (alert: PetAlert) => void;
}

const moodLine: Record<StockStatus, string> = {
  green: "今日组合状态稳定，核心逻辑正常。",
  yellow: "资源线降温，先看核心变量是否止跌。",
  red: "组合进入风控状态，需要复核中线逻辑。",
  overheated: "逻辑不差，但资金拥挤，别被热度带着跑。",
  watch: "方向不够明确，适合继续观察。"
};

const moodLabel: Record<StockStatus, string> = {
  green: "绿灯",
  yellow: "黄灯",
  red: "红灯",
  overheated: "过热",
  watch: "观察"
};

export default function PortfolioPanel({ mood, profiles, alerts, diagnostics, snapshot, onSelectStock, onSelectAlert }: PortfolioPanelProps) {
  const totalResourcePosition = profiles.reduce((sum, profile) => sum + profile.holding.positionRatio, 0);
  const dominantHolding = profiles.reduce<StockProfile | undefined>(
    (current, profile) => (!current || profile.holding.positionRatio > current.holding.positionRatio ? profile : current),
    undefined
  );
  const redSignalCount = profiles.reduce((sum, profile) => sum + profile.signals.filter((signal) => signal.status === "red").length, 0);
  const yellowSignalCount = profiles.reduce((sum, profile) => sum + profile.signals.filter((signal) => signal.status === "yellow").length, 0);
  const primaryFocus = buildPrimaryFocus(mood, redSignalCount, yellowSignalCount);
  const updatedAt = snapshot
    ? new Date(snapshot.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  return (
    <section className={`portfolio-panel panel-mood-${mood}`}>
      <div className="panel-hero">
        <div>
          <span className="panel-kicker">今日组合体检</span>
          <h2>{moodLine[mood]}</h2>
          <p>固定公式只观察逻辑、热度和集中度，不给机械买卖指令。</p>
        </div>
        <div className={`panel-status mood-${mood}`}>{moodLabel[mood]}</div>
      </div>

      <div className="portfolio-command">
        <div className="command-focus">
          <Compass size={18} />
          <div>
            <span>现在先看</span>
            <strong>{primaryFocus}</strong>
          </div>
        </div>
        <div className="command-pulse">
          <Clock3 size={14} />
          <span>{diagnostics ? `${diagnostics.readyAlerts.length} 条触发 / ${diagnostics.coolingAlerts.length} 条冷却` : "等待事件"}</span>
        </div>
      </div>

      <div className="panel-meta-grid">
        <div className="meta-tile">
          <Database size={16} />
          <span>数据来源</span>
          <strong>{snapshot ? dataSourceLabel(snapshot) : "读取中"}</strong>
          <small>{snapshot ? dataSourceDetail(snapshot, updatedAt) : updatedAt}</small>
        </div>
        <div className="meta-tile">
          <BellRing size={16} />
          <span>提醒节奏</span>
          <strong>{diagnostics?.readyAlerts.length ? "事件触发" : "冷静观察"}</strong>
          <small>{diagnostics ? diagnostics.nextLine : "正在等待固定公式给出提醒状态。"}</small>
        </div>
      </div>

      <div className="risk-summary">
        <div className={totalResourcePosition >= 80 ? "risk-hot" : "risk-watch"}>
          <ShieldAlert size={18} />
          <span>持仓集中度</span>
          <strong>{Math.round(totalResourcePosition)}%</strong>
          <small>{dominantHolding ? `${dominantHolding.holding.name}约 ${dominantHolding.holding.positionRatio}%` : "等待持仓"}</small>
        </div>
        <div className={redSignalCount > 0 ? "risk-hot" : "risk-watch"}>
          <Gauge size={18} />
          <span>风险灯</span>
          <strong>{redSignalCount} 红 / {yellowSignalCount} 黄</strong>
          <small>{redSignalCount > 0 ? "先复核变红变量" : "暂无强风险共振"}</small>
        </div>
        <div className="risk-watch">
          <BarChart3 size={18} />
          <span>中线逻辑</span>
          <strong>{profiles.length ? "公式运行中" : "待读取"}</strong>
          <small>只观察，不预测明日涨跌</small>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h3><Layers3 size={15} /> 持仓观察公式</h3>
          <span>点击股票卡片查看固定变量，不做短线指令。</span>
        </div>
      </div>

      <div className="cards-stack">
        {profiles.map((profile) => (
          <StockCard
            key={profile.holding.id}
            profile={profile}
            quote={snapshot?.quotes[profile.holding.id]}
            onSelect={() => onSelectStock(profile)}
          />
        ))}
      </div>

      <div className="alert-list">
        <div className="section-heading">
          <div>
            <h3><Activity size={15} /> 提醒记录</h3>
            <span>最近事件和冷却后的提醒。</span>
          </div>
        </div>
        {alerts.slice(0, 4).map((alert) => (
          <button key={alert.id} className={`alert-row severity-${alert.severity}`} onClick={() => onSelectAlert(alert)}>
            <span className="alert-dot" />
            <span className="alert-copy">
              <strong>{alert.title}</strong>
              <em>{alert.summary}</em>
            </span>
            <small>{alert.createdAt}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function buildPrimaryFocus(mood: StockStatus, redSignalCount: number, yellowSignalCount: number): string {
  if (mood === "red") return "风险共振是否改变持仓逻辑";
  if (mood === "overheated") return "资金拥挤是否继续升温";
  if (redSignalCount > 0) return "红灯变量是否只是事件噪音";
  if (yellowSignalCount > 0) return "黄灯变量能否降温修复";
  return "核心逻辑是否仍然完整";
}

function dataSourceLabel(snapshot: MarketSnapshot): string {
  const quoteStatus = snapshot.providerStatus?.find((status) => status.id === "quote");
  if (snapshot.source === "real" && quoteStatus?.status === "ok") return "真实行情数据";
  if (snapshot.source === "real" && quoteStatus?.status === "stale") return "真实行情部分返回";
  if (snapshot.source === "real") return "真实数据待接入";
  if (snapshot.source === "manual") return "手动录入";
  if (snapshot.source === "mock+manual") return "模拟数据 + 手动覆盖";
  return "本地模拟数据";
}

function dataSourceDetail(snapshot: MarketSnapshot, updatedAt: string): string {
  const providerIssue = snapshot.providerStatus?.find((status) => status.id === "quote" && (status.status === "disabled" || status.status === "error" || status.status === "stale"));
  if (providerIssue?.message) return providerIssue.message;
  if (snapshot.stale) return `缓存快照 ${updatedAt}`;
  return updatedAt;
}
