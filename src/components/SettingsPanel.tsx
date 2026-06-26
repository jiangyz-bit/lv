import { ArrowLeft, Database, Moon, Pin, Plus, Power, Shield, SlidersHorizontal, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { hydrateHoldingMetadata } from "../domain/stockCatalog";
import type { Holding, StockId, UserPreferences } from "../domain/types";

interface SettingsPanelProps {
  preferences: UserPreferences;
  holdings: Holding[];
  aiConfigured: boolean;
  aiBusyStockId?: string;
  aiMessage?: string;
  isAlwaysOnTop: boolean;
  launchAtLogin: boolean;
  onBack: () => void;
  onUpdatePreferences: (preferences: UserPreferences) => void;
  onHoldingsChange: (holdings: Holding[]) => void;
  onSaveDeepSeekApiKey: (apiKey: string) => Promise<void>;
  onAnalyzeHolding: (stockId: StockId) => Promise<void>;
  onToggleAlwaysOnTop: () => void;
  onLaunchAtLoginChange: (enabled: boolean) => void;
}

const horizons: Holding["horizon"][] = ["中线", "长期", "观察"];

export default function SettingsPanel({
  preferences,
  holdings,
  aiConfigured,
  aiBusyStockId,
  aiMessage,
  isAlwaysOnTop,
  launchAtLogin,
  onBack,
  onUpdatePreferences,
  onHoldingsChange,
  onSaveDeepSeekApiKey,
  onAnalyzeHolding,
  onToggleAlwaysOnTop,
  onLaunchAtLoginChange
}: SettingsPanelProps) {
  const [apiKeyInput, setApiKeyInput] = useState("");

  return (
    <section className="settings-panel">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        返回
      </button>
      <div className="settings-title">
        <SlidersHorizontal size={22} />
        <div>
          <h2>提醒与桌面设置</h2>
          <p>让宠物主动，但别变成噪音。</p>
        </div>
      </div>

      <label className="toggle-row">
        <span><Shield size={17} />今天只提醒红灯</span>
        <input
          type="checkbox"
          checked={preferences.redOnly}
          onChange={(event) => onUpdatePreferences({ ...preferences, redOnly: event.target.checked })}
        />
      </label>

      <label className="toggle-row">
        <span><Moon size={17} />安静模式</span>
        <input
          type="checkbox"
          checked={preferences.quietMode}
          onChange={(event) => onUpdatePreferences({ ...preferences, quietMode: event.target.checked })}
        />
      </label>

      <label className="toggle-row">
        <span><Pin size={17} />窗口置顶</span>
        <input type="checkbox" checked={isAlwaysOnTop} onChange={onToggleAlwaysOnTop} />
      </label>

      <label className="toggle-row">
        <span><Power size={17} />开机自启</span>
        <input type="checkbox" checked={launchAtLogin} onChange={(event) => onLaunchAtLoginChange(event.target.checked)} />
      </label>

      <div className="settings-group">
        <h3>风险敏感度</h3>
        <div className="segmented">
          {(["low", "balanced", "high"] as const).map((level) => (
            <button
              key={level}
              className={preferences.sensitivity === level ? "active" : ""}
              onClick={() => onUpdatePreferences({ ...preferences, sensitivity: level })}
            >
              {level === "low" ? "低" : level === "balanced" ? "均衡" : "高"}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h3><Database size={16} /> 数据源</h3>
        <div className="provider-lock">
          <strong>真实股票数据</strong>
          <span>行情来自新浪公开数据；接口异常时仅使用内部缓存/兜底状态提示。</span>
        </div>
      </div>

      <div className="settings-group">
        <h3>DeepSeek 智能识别</h3>
        <div className="ai-key-panel">
          <span>{aiConfigured ? "API Key 已配置，股票卡片可调用智能识别。" : "保存 API Key 后，可用 DeepSeek 生成中性持仓观察逻辑。"}</span>
          <div className="ai-key-row">
            <input
              type="password"
              placeholder={aiConfigured ? "输入新 Key 可替换，留空可清空" : "粘贴 DeepSeek API Key"}
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
            />
            <button
              className="secondary-button"
              onClick={async () => {
                await onSaveDeepSeekApiKey(apiKeyInput);
                setApiKeyInput("");
              }}
            >
              保存
            </button>
          </div>
          {aiMessage ? <small>{aiMessage}</small> : null}
        </div>
      </div>

      <div className="settings-group holdings-editor">
        <h3><Wallet size={16} /> 持仓股票</h3>
        <div className="holding-list">
          {holdings.map((holding) => (
            <div className="manual-card holding-card" key={holding.id}>
              <div className="holding-card-head">
                <strong>{holding.name}</strong>
                <button
                  className="icon-button danger"
                  title={holdings.length > 1 ? "删除股票" : "至少保留一只股票"}
                  disabled={holdings.length <= 1}
                  onClick={() => deleteHolding(holding.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <label>
                代码
                <input value={holding.code} placeholder="例如 002155" onChange={(event) => updateCode(holding.id, event.target.value)} />
              </label>
              <label>
                仓位%
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={holding.positionRatio}
                  onChange={(event) => updateHolding(holding.id, { positionRatio: numberValue(event.target.value) })}
                />
              </label>
              <label>
                周期
                <select value={holding.horizon} onChange={(event) => updateHolding(holding.id, { horizon: event.target.value as Holding["horizon"] })}>
                  {horizons.map((horizon) => (
                    <option key={horizon} value={horizon}>{horizon}</option>
                  ))}
                </select>
              </label>
              <div className="auto-stock-meta">
                <span>自动识别</span>
                <strong>{holding.name}</strong>
                <small>{holding.thesis}</small>
                <button
                  className="secondary-button compact"
                  disabled={!aiConfigured || !holding.code || aiBusyStockId === holding.id}
                  onClick={() => onAnalyzeHolding(holding.id)}
                >
                  {aiBusyStockId === holding.id ? "识别中" : "智能识别逻辑"}
                </button>
              </div>
            </div>
          ))}
          <button className="add-holding-button" onClick={addHolding}>
            <Plus size={16} />
            添加股票
          </button>
        </div>
      </div>
    </section>
  );

  function updateCode(stockId: StockId, code: string) {
    onHoldingsChange(
      holdings.map((holding) => {
        if (holding.id !== stockId) return holding;
        return hydrateHoldingMetadata({ ...holding, code, thesis: "" });
      })
    );
  }

  function updateHolding(stockId: StockId, patch: Partial<Holding>) {
    onHoldingsChange(holdings.map((holding) => (holding.id === stockId ? { ...holding, ...patch } : holding)));
  }

  function addHolding() {
    const id = `custom-${Date.now()}`;
    onHoldingsChange([
      ...holdings,
      hydrateHoldingMetadata({
        id,
        name: "",
        code: "",
        positionRatio: 0,
        costNote: "手动添加",
        thesis: "",
        horizon: "观察"
      })
    ]);
  }

  function deleteHolding(stockId: StockId) {
    if (holdings.length <= 1) return;
    onHoldingsChange(holdings.filter((holding) => holding.id !== stockId));
  }
}

function numberValue(value: string): number {
  if (value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
