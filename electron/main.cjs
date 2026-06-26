const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, safeStorage, net } = require("electron");
const fs = require("fs");
const https = require("https");
const path = require("path");

let mainWindow;
let tray;
let saveBoundsTimer;
let dragState;

const SINA_QUOTE_ENDPOINT = "https://hq.sinajs.cn/list=";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

function createWindow() {
  const savedBounds = readWindowBounds();
  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 520,
    height: savedBounds?.height ?? 720,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 260,
    minHeight: 220,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    title: "持仓逻辑宠物",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setSkipTaskbar(true);
  mainWindow.on("resize", scheduleSaveWindowBounds);
  mainWindow.on("resized", scheduleSaveWindowBounds);
  mainWindow.on("move", scheduleSaveWindowBounds);
  mainWindow.on("moved", scheduleSaveWindowBounds);

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    mainWindow.loadURL(devServer);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("持仓逻辑宠物");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => showMainWindow("pet"));
  tray.on("right-click", () => tray?.popUpContextMenu(buildTrayMenu()));
}

function createTrayIcon() {
  const pngPath = path.join(__dirname, "assets", "donkey-head-tray.png");
  if (fs.existsSync(pngPath)) {
    const icon = nativeImage.createFromPath(pngPath);
    if (!icon.isEmpty()) return icon.resize({ width: 18, height: 18, quality: "best" });
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#172328"/>
      <path d="M8 17c0-5 3.5-9 8-9s8 4 8 9v4c0 2.8-2.2 5-5 5h-6c-2.8 0-5-2.2-5-5v-4z" fill="#4f7376"/>
      <path d="M10 10c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" stroke="#ffd66f" stroke-width="4" stroke-linecap="round"/>
      <circle cx="13" cy="17" r="2" fill="#c8fff0"/>
      <circle cx="19" cy="17" r="2" fill="#c8fff0"/>
      <path d="M14 22c1.3 1 2.7 1 4 0" stroke="#c8fff0" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: "显示宠物", click: () => showMainWindow("pet") },
    { label: "显示组合面板", click: () => showMainWindow("panel") },
    { label: "打开设置", click: () => showMainWindow("settings") },
    { type: "separator" },
    {
      label: mainWindow?.isAlwaysOnTop() ? "取消窗口置顶" : "保持窗口置顶",
      click: () => {
        toggleAlwaysOnTop();
        tray?.setContextMenu(buildTrayMenu());
      }
    },
    { label: "最小化窗口", click: () => mainWindow?.minimize() },
    { label: "隐藏到托盘", click: () => mainWindow?.hide() },
    { type: "separator" },
    {
      label: app.getLoginItemSettings().openAtLogin ? "关闭开机自启" : "开启开机自启",
      click: () => {
        const next = !app.getLoginItemSettings().openAtLogin;
        app.setLoginItemSettings({ openAtLogin: next });
        tray?.setContextMenu(buildTrayMenu());
      }
    },
    { type: "separator" },
    {
      label: "关闭宠物",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function showMainWindow(targetView) {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
  if (targetView) sendNavigate(targetView);
}

function toggleAlwaysOnTop() {
  if (!mainWindow) return false;
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next, "floating");
  tray?.setContextMenu(buildTrayMenu());
  return next;
}

function sendNavigate(targetView) {
  if (!mainWindow) return;
  const send = () => mainWindow?.webContents.send("app:navigate", targetView);
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", send);
    return;
  }
  send();
}

function windowBoundsPath() {
  return path.join(app.getPath("userData"), "window-bounds.json");
}

function readWindowBounds() {
  try {
    const raw = fs.readFileSync(windowBoundsPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function scheduleSaveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    try {
      fs.writeFileSync(windowBoundsPath(), JSON.stringify(mainWindow.getBounds()), "utf8");
    } catch {
      // Window position persistence should never block the pet itself.
    }
  }, 200);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  if (app.isQuitting) app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  showMainWindow();
});

ipcMain.handle("market:fetchQuotes", async (_event, codes) => {
  return fetchMarketQuotes(Array.isArray(codes) ? codes : []);
});

ipcMain.handle("ai:getStatus", () => {
  return { configured: Boolean(readDeepSeekApiKey()) };
});

ipcMain.handle("ai:setApiKey", (_event, apiKey) => {
  writeDeepSeekApiKey(String(apiKey ?? ""));
  return { configured: Boolean(readDeepSeekApiKey()) };
});

ipcMain.handle("ai:analyzeHolding", async (_event, payload) => {
  return analyzeHoldingWithDeepSeek(payload ?? {});
});

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:hide", () => {
  mainWindow?.hide();
});

ipcMain.handle("window:show", () => {
  showMainWindow();
});

ipcMain.handle("window:close", () => {
  app.isQuitting = true;
  mainWindow?.close();
});

ipcMain.handle("window:isAlwaysOnTop", () => {
  return Boolean(mainWindow?.isAlwaysOnTop());
});

ipcMain.handle("window:toggleAlwaysOnTop", () => {
  return toggleAlwaysOnTop();
});

ipcMain.handle("window:setViewMode", (_event, mode) => {
  if (!mainWindow) return;
  const nextSize = mode === "pet" ? { width: 340, height: 430 } : { width: 650, height: 720 };
  const current = mainWindow.getBounds();
  if (current.width === nextSize.width && current.height === nextSize.height) return;
  mainWindow.setSize(nextSize.width, nextSize.height, true);
  scheduleSaveWindowBounds();
});

ipcMain.handle("window:beginDrag", (_event, point) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  dragState = {
    startX: Number(point?.screenX ?? 0),
    startY: Number(point?.screenY ?? 0),
    bounds
  };
});

ipcMain.handle("window:dragTo", (_event, point) => {
  if (!mainWindow || !dragState) return;
  const dx = Math.round(Number(point?.screenX ?? dragState.startX) - dragState.startX);
  const dy = Math.round(Number(point?.screenY ?? dragState.startY) - dragState.startY);
  mainWindow.setPosition(dragState.bounds.x + dx, dragState.bounds.y + dy, false);
});

ipcMain.handle("window:endDrag", () => {
  dragState = undefined;
  scheduleSaveWindowBounds();
});

ipcMain.handle("app:getLaunchAtLogin", () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("app:setLaunchAtLogin", (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  tray?.setContextMenu(buildTrayMenu());
  return app.getLoginItemSettings().openAtLogin;
});

async function fetchMarketQuotes(codes) {
  const symbols = codes.map(sinaSymbolForCode).filter(Boolean);
  if (!symbols.length) return [];

  const body = await httpsGetGbk(`${SINA_QUOTE_ENDPOINT}${symbols.join(",")}`, {
    Referer: "https://finance.sina.com.cn/",
    "User-Agent": "Mozilla/5.0 position-logic-pet"
  });
  const updatedAt = new Date().toISOString();
  return parseSinaQuotes(body, updatedAt);
}

function sinaSymbolForCode(code) {
  const normalized = normalizeStockCode(code);
  if (!/^\d{6}$/.test(normalized)) return undefined;
  const market = normalized.startsWith("5") || normalized.startsWith("6") || normalized.startsWith("9") ? "sh" : "sz";
  return `${market}${normalized}`;
}

function parseSinaQuotes(body, fallbackUpdatedAt) {
  const quotes = [];
  const pattern = /var hq_str_(sh|sz)(\d{6})="([^"]*)";/g;
  for (const match of body.matchAll(pattern)) {
    const code = match[2];
    const fields = match[3].split(",");
    const name = fields[0];
    const previousClose = numberOrUndefined(fields[2]);
    const price = numberOrUndefined(fields[3]);
    const changePct =
      typeof price === "number" && typeof previousClose === "number" && previousClose > 0
        ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
        : undefined;
    const quoteDate = fields[30];
    const quoteTime = fields[31];
    quotes.push({
      code,
      name,
      price,
      changePct,
      turnoverRate: undefined,
      updatedAt: quoteDate && quoteTime ? `${quoteDate}T${quoteTime}+08:00` : fallbackUpdatedAt
    });
  }
  return quotes.filter((quote) => quote.code && quote.name);
}

function httpsGetGbk(url, headers) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`新浪行情请求失败：HTTP ${response.statusCode}`));
          return;
        }
        resolve(new TextDecoder("gbk").decode(Buffer.concat(chunks)));
      });
    });
    request.on("error", reject);
    request.setTimeout(15_000, () => {
      request.destroy(new Error("新浪行情请求超时"));
    });
  });
}

function numberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeStockCode(code) {
  return String(code ?? "").trim().toUpperCase().replace(/^S[HZ]/, "");
}

async function analyzeHoldingWithDeepSeek(payload) {
  const apiKey = readDeepSeekApiKey();
  if (!apiKey) throw new Error("DeepSeek API Key 未配置");

  const code = normalizeStockCode(payload.code);
  const name = String(payload.name ?? code).slice(0, 40);
  const currentThesis = String(payload.thesis ?? "").slice(0, 200);

  const response = await net.fetch(DEEPSEEK_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || readProjectEnvValue("DEEPSEEK_MODEL") || DEFAULT_DEEPSEEK_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是股票持仓逻辑整理助手。只输出 JSON，不给买卖建议，不预测明日涨跌，不承诺收益。你的任务是把股票的中线观察逻辑整理成中性、克制、可复核的描述。"
        },
        {
          role: "user",
          content: JSON.stringify({
            code,
            name,
            currentThesis,
            requirement:
              "返回 JSON：{ thesis: string, watchPoints: string[] }。thesis 不超过 42 个中文字符，用加号连接核心逻辑；watchPoints 给 3 条观察项。"
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`DeepSeek 请求失败：HTTP ${response.status}${text ? ` ${text.slice(0, 120)}` : ""}`);
  }

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  const parsed = parseJsonContent(content);
  const thesis = String(parsed?.thesis ?? "").trim();
  const watchPoints = Array.isArray(parsed?.watchPoints) ? parsed.watchPoints.map((item) => String(item).trim()).filter(Boolean).slice(0, 3) : [];
  if (!thesis) throw new Error("DeepSeek 返回内容缺少 thesis");

  return {
    thesis,
    watchPoints,
    model: body?.model,
    updatedAt: new Date().toISOString()
  };
}

function parseJsonContent(content) {
  if (!content) return undefined;
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    return JSON.parse(match[0]);
  }
}

function secretsPath() {
  return path.join(app.getPath("userData"), "secrets.json");
}

function readDeepSeekApiKey() {
  return process.env.DEEPSEEK_API_KEY || readProjectEnvValue("DEEPSEEK_API_KEY") || readSavedDeepSeekApiKey();
}

function readSavedDeepSeekApiKey() {
  try {
    const raw = JSON.parse(fs.readFileSync(secretsPath(), "utf8"));
    if (!raw.deepseekApiKey) return "";
    if (raw.encrypted && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(raw.deepseekApiKey, "base64"));
    }
    return String(raw.deepseekApiKey);
  } catch {
    return "";
  }
}

function writeDeepSeekApiKey(apiKey) {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    try {
      fs.rmSync(secretsPath(), { force: true });
    } catch {
      // Clearing a missing key is harmless.
    }
    return;
  }

  const encrypted = safeStorage.isEncryptionAvailable();
  const value = encrypted ? safeStorage.encryptString(trimmed).toString("base64") : trimmed;
  fs.writeFileSync(secretsPath(), JSON.stringify({ encrypted, deepseekApiKey: value }), "utf8");
}

function readProjectEnvValue(name) {
  try {
    const envPath = path.join(__dirname, "..", ".env.local");
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    const prefix = `${name}=`;
    const line = lines.find((item) => item.trim().startsWith(prefix));
    if (!line) return "";
    return line.slice(prefix.length).trim().replace(/^['"]|['"]$/g, "");
  } catch {
    return "";
  }
}
