import type { QuotePoint, SignalStatus, StockProfile, StockStatus } from "../domain/types";

interface StockCardProps {
  profile: StockProfile;
  quote?: QuotePoint;
  onSelect: () => void;
}

const statusLabel: Record<StockStatus, string> = {
  green: "绿灯",
  yellow: "黄灯",
  red: "红灯",
  overheated: "过热",
  watch: "观察"
};

const signalLabel: Record<SignalStatus, string> = {
  green: "绿",
  yellow: "黄",
  red: "红"
};

export default function StockCard({ profile, quote, onSelect }: StockCardProps) {
  const primaryRisk = profile.reasons[0] ?? profile.holding.thesis;

  return (
    <button className={`stock-card status-${profile.status}`} onClick={onSelect}>
      <div className="stock-card-top">
        <div>
          <h3>{profile.holding.name}</h3>
          <span>{profile.holding.code} · {profile.holding.horizon} · 仓位约 {profile.holding.positionRatio}%</span>
        </div>
        <strong>{statusLabel[profile.status]}</strong>
      </div>
      <div className="stock-card-market">
        <span>
          <em>现价</em>
          <strong>{formatPrice(quote?.price)}</strong>
        </span>
        <span className={changeClass(quote?.changePct)}>
          <em>涨跌</em>
          <strong>{formatPct(quote?.changePct)}</strong>
        </span>
        <span>
          <em>换手</em>
          <strong>{formatRate(quote?.turnoverRate)}</strong>
        </span>
        <span>
          <em>评分</em>
          <strong>{profile.score}</strong>
        </span>
      </div>
      <div className="stock-card-logic">
        <span>{profile.holding.thesis}</span>
        <small>{primaryRisk}</small>
      </div>
      <div className="signal-grid">
        {profile.signals.map((signal) => (
          <span key={signal.id} className={`signal-chip signal-${signal.status}`} title={signal.note}>
            {signal.label} {signalLabel[signal.status]}
          </span>
        ))}
      </div>
    </button>
  );
}

function formatPrice(value?: number): string {
  if (typeof value !== "number") return "--";
  return value >= 10 ? value.toFixed(2) : value.toFixed(3);
}

function formatPct(value?: number): string {
  if (typeof value !== "number") return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatRate(value?: number): string {
  if (typeof value !== "number") return "--";
  return `${value.toFixed(1)}%`;
}

function changeClass(value?: number): string {
  if (typeof value !== "number") return "";
  if (value > 0) return "metric-up";
  if (value < 0) return "metric-down";
  return "";
}
