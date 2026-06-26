import { useEffect, useMemo, useState } from "react";
import AlertDetail from "./components/AlertDetail";
import PetShell from "./components/PetShell";
import PortfolioPanel from "./components/PortfolioPanel";
import SettingsPanel from "./components/SettingsPanel";
import { buildAlertDiagnostics, buildDisplayedAlerts } from "./domain/alertEngine";
import { emptyManualInput, loadSnapshot } from "./domain/dataProviders";
import { defaultPreferences, holdings as defaultHoldings, scenarios } from "./domain/mockData";
import { buildProfilesFromSnapshot, portfolioMood } from "./domain/scoring";
import { hydrateHoldingMetadata } from "./domain/stockCatalog";
import type { DataProviderMode, Holding, MarketSnapshot, PetAlert, StockProfile, UserPreferences } from "./domain/types";

type View = "pet" | "panel" | "alert" | "settings";

const preferencesKey = "position-pet-preferences";
const dataModeKey = "position-pet-data-mode";
const alertHistoryKey = "position-pet-alert-history";
const holdingsKey = "position-pet-holdings";
const snapshotCacheKey = "position-pet-snapshot-cache";

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(preferencesKey);
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function loadPortfolioHoldings(): Holding[] {
  try {
    const stored = localStorage.getItem(holdingsKey);
    return stored ? sanitizeHoldings(JSON.parse(stored)) : defaultHoldings;
  } catch {
    return defaultHoldings;
  }
}

function loadDataMode(): DataProviderMode {
  return "real";
}

function loadCachedSnapshot(): MarketSnapshot | undefined {
  try {
    const stored = localStorage.getItem(snapshotCacheKey);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

function loadHistory(): PetAlert[] {
  try {
    const stored = localStorage.getItem(alertHistoryKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [view, setView] = useState<View>("pet");
  const [selectedAlert, setSelectedAlert] = useState<PetAlert | undefined>();
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);
  const [dataMode] = useState<DataProviderMode>(loadDataMode);
  const [portfolioHoldings, setPortfolioHoldings] = useState<Holding[]>(loadPortfolioHoldings);
  const [snapshot, setSnapshot] = useState<MarketSnapshot>();
  const [alertHistory, setAlertHistory] = useState<PetAlert[]>(loadHistory);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiBusyStockId, setAiBusyStockId] = useState<string>();
  const [aiMessage, setAiMessage] = useState<string>();

  const activeScenario = scenarios[0];
  const profiles = useMemo(() => (snapshot ? buildProfilesFromSnapshot(snapshot, portfolioHoldings) : []), [portfolioHoldings, snapshot]);
  const mood = profiles.length ? portfolioMood(profiles) : "watch";
  const alertDiagnostics = useMemo(
    () => (snapshot ? buildAlertDiagnostics({ profiles, snapshot, preferences, history: alertHistory }) : undefined),
    [alertHistory, preferences, profiles, snapshot]
  );
  const alerts = useMemo(() => {
    const displayed = snapshot ? buildDisplayedAlerts({ profiles, snapshot, preferences, history: alertHistory }) : [];
    const byId = new Map<string, PetAlert>();
    [...alertHistory, ...displayed].forEach((alert) => byId.set(alert.id, alert));
    return [...byId.values()].slice(0, 8);
  }, [alertHistory, preferences, profiles, snapshot]);
  const recentHistoryAlert = alertHistory.find((alert) => alert.createdAtMs && Date.now() - alert.createdAtMs < 90 * 60_000);
  const bubble = alertDiagnostics?.readyAlerts[0] ?? recentHistoryAlert;

  useEffect(() => {
    let cancelled = false;
    loadSnapshot(dataMode, activeScenario, emptyManualInput, portfolioHoldings, loadCachedSnapshot()).then((nextSnapshot) => {
      if (!cancelled) {
        setSnapshot(nextSnapshot);
        if (!nextSnapshot.stale) {
          localStorage.setItem(snapshotCacheKey, JSON.stringify(nextSnapshot));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeScenario, dataMode, portfolioHoldings]);

  useEffect(() => {
    if (!snapshot || !profiles.length) return;
    const events = alertDiagnostics?.readyAlerts ?? [];
    if (!events.length) return;

    setAlertHistory((current) => {
      const existingIds = new Set(current.map((alert) => alert.id));
      const nextEvents = events.filter((alert) => !existingIds.has(alert.id));
      return nextEvents.length ? [...nextEvents, ...current].slice(0, 40) : current;
    });
  }, [alertDiagnostics, alertHistory]);

  useEffect(() => {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    localStorage.setItem(dataModeKey, dataMode);
  }, [dataMode]);

  useEffect(() => {
    localStorage.setItem(holdingsKey, JSON.stringify(portfolioHoldings));
  }, [portfolioHoldings]);

  useEffect(() => {
    localStorage.setItem(alertHistoryKey, JSON.stringify(alertHistory));
  }, [alertHistory]);

  useEffect(() => {
    window.petWindow?.isAlwaysOnTop?.().then(setIsAlwaysOnTop);
    window.petWindow?.getLaunchAtLogin?.().then(setLaunchAtLogin);
    window.petAi?.getStatus?.().then((status) => setAiConfigured(Boolean(status.configured)));
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.source !== "real") return;
    setPortfolioHoldings((current) => {
      let changed = false;
      const next = current.map((holding) => {
        const realName = snapshot.quotes[holding.id]?.name;
        if (!realName || realName === holding.name) return holding;
        changed = true;
        return { ...holding, name: realName };
      });
      return changed ? next : current;
    });
  }, [snapshot]);

  useEffect(() => {
    window.petWindow?.setViewMode?.(view === "pet" ? "pet" : "panel");
  }, [view]);

  useEffect(() => {
    return window.petWindow?.onNavigate?.((nextView) => {
      setSelectedAlert(undefined);
      setView(nextView);
    });
  }, []);

  function openAlert(alert: PetAlert) {
    setSelectedAlert(alert);
    setView("alert");
  }

  function openStock(profile: StockProfile) {
    const stockAlert = alerts.find((alert) => alert.stockId === profile.holding.id) ?? {
      id: `${profile.holding.id}-manual`,
      eventKey: `${profile.holding.id}-manual`,
      stockId: profile.holding.id,
      title: `${profile.holding.name}详情`,
      severity: "light" as const,
      summary: profile.headline,
      whyNow: "你主动点开了股票卡片，所以展示固定观察公式。",
      reasons: profile.reasons.length ? profile.reasons : ["当前没有明显风险共振。"],
      interpretation: profile.status === "green" ? "核心逻辑正常，继续观察关键变量即可。" : "状态有变化，重点看信号灯里变黄或变红的指标。",
      nextWatch: profile.nextWatch,
      createdAt: "现在",
      createdAtMs: Date.now()
    };
    openAlert(stockAlert);
  }

  function recordFeedback(kind: keyof UserPreferences["feedbackCounts"]) {
    setPreferences((current) => ({
      ...current,
      feedbackCounts: {
        ...current.feedbackCounts,
        [kind]: current.feedbackCounts[kind] + 1
      },
      sensitivity: kind === "tooFrequent" ? "low" : current.sensitivity
    }));
  }

  function closeWindow() {
    if (window.petWindow) {
      window.petWindow.hide?.();
      return;
    }
    setView("pet");
  }

  async function toggleAlwaysOnTop() {
    const next = await window.petWindow?.toggleAlwaysOnTop?.();
    if (typeof next === "boolean") setIsAlwaysOnTop(next);
  }

  async function updateLaunchAtLogin(enabled: boolean) {
    const next = await window.petWindow?.setLaunchAtLogin?.(enabled);
    setLaunchAtLogin(typeof next === "boolean" ? next : enabled);
  }

  function updatePortfolioHoldings(nextHoldings: Holding[]) {
    const sanitized = sanitizeHoldings(nextHoldings);
    setPortfolioHoldings(sanitized);
  }

  async function saveDeepSeekApiKey(apiKey: string) {
    const status = await window.petAi?.setApiKey?.(apiKey);
    const configured = Boolean(status?.configured);
    setAiConfigured(configured);
    setAiMessage(configured ? "DeepSeek 已配置，可用于识别持仓逻辑。" : "DeepSeek Key 已清空。");
  }

  async function analyzeHoldingLogic(stockId: string) {
    const holding = portfolioHoldings.find((item) => item.id === stockId);
    if (!holding || !window.petAi) return;

    setAiBusyStockId(stockId);
    setAiMessage(undefined);
    try {
      const result = await window.petAi.analyzeHolding({ code: holding.code, name: holding.name, thesis: holding.thesis });
      setPortfolioHoldings((current) =>
        current.map((item) =>
          item.id === stockId
            ? {
                ...item,
                thesis: result.thesis,
                costNote: result.watchPoints.length ? result.watchPoints.join("；") : item.costNote
              }
            : item
        )
      );
      setAiMessage(`${holding.name} 的观察逻辑已更新。`);
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "DeepSeek 识别失败");
    } finally {
      setAiBusyStockId(undefined);
    }
  }

  return (
    <main className={`app-root view-${view}`}>
      <PetShell
        mood={mood}
        bubble={bubble}
        panelOpen={view !== "pet"}
        onTogglePanel={() => setView((current) => (current === "panel" ? "pet" : "panel"))}
      />

      {view === "panel" ? (
        <PortfolioPanel
          mood={mood}
          profiles={profiles}
          alerts={alerts}
          diagnostics={alertDiagnostics}
          snapshot={snapshot}
          onSelectStock={openStock}
          onSelectAlert={openAlert}
        />
      ) : null}

      {view === "alert" && selectedAlert ? (
        <AlertDetail alert={selectedAlert} onBack={() => setView("panel")} onFeedback={recordFeedback} />
      ) : null}

      {view === "settings" ? (
        <SettingsPanel
          preferences={preferences}
          holdings={portfolioHoldings}
          aiConfigured={aiConfigured}
          aiBusyStockId={aiBusyStockId}
          aiMessage={aiMessage}
          isAlwaysOnTop={isAlwaysOnTop}
          launchAtLogin={launchAtLogin}
          onBack={() => setView("panel")}
          onUpdatePreferences={setPreferences}
          onHoldingsChange={updatePortfolioHoldings}
          onSaveDeepSeekApiKey={saveDeepSeekApiKey}
          onAnalyzeHolding={analyzeHoldingLogic}
          onToggleAlwaysOnTop={toggleAlwaysOnTop}
          onLaunchAtLoginChange={updateLaunchAtLogin}
        />
      ) : null}
    </main>
  );
}

function sanitizeHoldings(value: unknown): Holding[] {
  if (!Array.isArray(value)) return defaultHoldings;
  const seen = new Set<string>();
  const holdings = value
    .map((item, index) => {
      const source = item as Partial<Holding>;
      const id = typeof source.id === "string" && source.id.trim() ? source.id.trim() : `custom-${index}-${Date.now()}`;
      if (seen.has(id)) return undefined;
      seen.add(id);
      const horizon = source.horizon === "长期" || source.horizon === "中线" || source.horizon === "观察" ? source.horizon : "观察";
      const baseHolding = {
        id,
        name: "",
        code: typeof source.code === "string" ? source.code.trim() : "",
        positionRatio: clampNumber(source.positionRatio, 0, 100),
        costNote: typeof source.costNote === "string" ? source.costNote : "手动添加",
        thesis: typeof source.thesis === "string" ? source.thesis.trim() : "",
        horizon
      };
      const hydrated = hydrateHoldingMetadata(baseHolding);
      return {
        ...hydrated,
        thesis: baseHolding.thesis || hydrated.thesis
      };
    })
    .filter(Boolean) as Holding[];

  return holdings.length ? holdings : defaultHoldings;
}

function clampNumber(value: unknown, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
