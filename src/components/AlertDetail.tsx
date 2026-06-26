import { ArrowLeft, Check, CheckCircle2, ClipboardList, Eye, Gauge, MessageSquare, Route, TriangleAlert, VolumeX } from "lucide-react";
import type { PetAlert } from "../domain/types";

interface AlertDetailProps {
  alert: PetAlert;
  onBack: () => void;
  onFeedback: (kind: "useful" | "tooFrequent" | "notImportant" | "tooComplex") => void;
}

export default function AlertDetail({ alert, onBack, onFeedback }: AlertDetailProps) {
  const severityLabel = alert.severity === "strong" ? "强提醒" : alert.severity === "medium" ? "中提醒" : "轻提醒";

  return (
    <section className={`detail-panel detail-page severity-${alert.severity}`}>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        返回
      </button>

      <div className="detail-hero">
        <div className="severity-medallion">
          <TriangleAlert size={22} />
        </div>
        <div className="detail-title">
          <span>{severityLabel} · {alert.createdAt}</span>
          <h2>{alert.title}</h2>
          <p>{alert.summary}</p>
        </div>
      </div>

      <div className="why-now-card">
        <div className="section-heading">
          <div>
            <h3><Gauge size={15} /> 为什么现在提醒</h3>
            <span>事件触发 + 冷却规则后的解释。</span>
          </div>
        </div>
        <p>{alert.whyNow}</p>
      </div>

      <div className="detail-grid">
        <div className="detail-section evidence-section">
          <h3><ClipboardList size={15} /> 触发依据</h3>
          <ol className="reason-list">
            {alert.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ol>
        </div>

        <div className="detail-section interpretation">
          <h3><MessageSquare size={15} /> 宠物判断</h3>
          <p>{alert.interpretation}</p>
        </div>
      </div>

      <div className="detail-section next-watch-card">
        <h3><Route size={15} /> 下一步观察</h3>
        <div className="watch-list">
          {alert.nextWatch.map((item) => (
            <span key={item}><CheckCircle2 size={14} />{item}</span>
          ))}
        </div>
      </div>

      <div className="feedback-panel">
        <div>
          <strong>调校提醒</strong>
          <span>你的反馈会降低噪音，不会生成买卖指令。</span>
        </div>
        <div className="feedback-bar">
          <button onClick={() => onFeedback("useful")}><Check size={15} />有用</button>
          <button onClick={() => onFeedback("tooFrequent")}><VolumeX size={15} />太频繁</button>
          <button onClick={() => onFeedback("notImportant")}><Eye size={15} />不重要</button>
          <button onClick={() => onFeedback("tooComplex")}>太复杂</button>
        </div>
      </div>
    </section>
  );
}
