/// <reference types="vite/client" />

interface Window {
  petWindow?: {
    minimize: () => Promise<void>;
    hide: () => Promise<void>;
    show: () => Promise<void>;
    close: () => Promise<void>;
    isAlwaysOnTop: () => Promise<boolean>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    setViewMode: (mode: "pet" | "panel") => Promise<void>;
    beginDrag: (point: { screenX: number; screenY: number }) => Promise<void>;
    dragTo: (point: { screenX: number; screenY: number }) => Promise<void>;
    endDrag: () => Promise<void>;
    getLaunchAtLogin: () => Promise<boolean>;
    setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
    onNavigate: (callback: (view: "pet" | "panel" | "settings") => void) => () => void;
  };
  marketData?: {
    fetchQuotes: (codes: string[]) => Promise<Array<{
      code: string;
      name: string;
      price?: number;
      changePct?: number;
      turnoverRate?: number;
      updatedAt: string;
    }>>;
  };
  petAi?: {
    getStatus: () => Promise<{ configured: boolean }>;
    setApiKey: (apiKey: string) => Promise<{ configured: boolean }>;
    analyzeHolding: (payload: { code: string; name: string; thesis?: string }) => Promise<{
      thesis: string;
      watchPoints: string[];
      model?: string;
      updatedAt: string;
    }>;
  };
}
