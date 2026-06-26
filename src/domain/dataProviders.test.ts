import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManualSnapshot, createMockMarketDataProvider, loadSnapshot, mergeSnapshots } from "./dataProviders";
import { buildProfilesFromSnapshot } from "./scoring";
import type { Holding, Scenario } from "./types";

const customHolding: Holding = {
  id: "chip-etf",
  name: "芯片ETF",
  code: "159995",
  positionRatio: 1,
  costNote: "小仓位观察",
  thesis: "用于分散资源仓位的观察仓",
  horizon: "观察"
};

const testScenario: Scenario = {
  id: "cooling",
  label: "测试场景",
  description: "测试用",
  signalOverrides: {}
};

test("manual snapshot overrides provider values and keeps source metadata", async () => {
  const provider = createMockMarketDataProvider();
  const providerSnapshot = await provider.getSnapshot();
  const manualSnapshot = buildManualSnapshot({
    quotes: {
      "hunan-gold": { changePct: -4.2, turnoverRate: 7.1 }
    },
    commodities: {
      gold: { trend: "down", changePct: -2.4 },
      antimony: { trend: "down", changePct: -3.1 }
    }
  });

  const snapshot = mergeSnapshots(providerSnapshot, manualSnapshot);

  assert.equal(snapshot.source, "mock+manual");
  assert.equal(snapshot.quotes["hunan-gold"].changePct, -4.2);
  assert.equal(snapshot.commodities.gold.source, "manual");
});

test("snapshot values turn into holding-logic signal statuses", async () => {
  const provider = createMockMarketDataProvider("red-risk");
  const profiles = buildProfilesFromSnapshot(await provider.getSnapshot());
  const hunan = profiles.find((profile) => profile.holding.id === "hunan-gold");
  const tungsten = profiles.find((profile) => profile.holding.id === "china-tungsten");

  assert.equal(hunan?.signals.find((signal) => signal.id === "gold")?.status, "red");
  assert.equal(hunan?.signals.find((signal) => signal.id === "antimony")?.status, "red");
  assert.equal(tungsten?.signals.find((signal) => signal.id === "crowding")?.status, "red");
});

test("manual announcements and portfolio news affect observation signals", () => {
  const snapshot = buildManualSnapshot({
    announcements: [
      {
        id: "manual-china-tungsten",
        stockId: "china-tungsten",
        title: "手动：公司变量需要复核",
        tone: "negative",
        source: "manual",
        publishedAt: "2026-06-26T10:00:00+08:00"
      }
    ],
    news: [
      {
        id: "manual-portfolio",
        relatedTo: "portfolio",
        title: "手动：资源线情绪降温",
        tone: "negative",
        source: "manual",
        publishedAt: "2026-06-26T10:00:00+08:00"
      }
    ]
  });

  const profiles = buildProfilesFromSnapshot(snapshot);
  const hunan = profiles.find((profile) => profile.holding.id === "hunan-gold");
  const tungsten = profiles.find((profile) => profile.holding.id === "china-tungsten");

  assert.equal(hunan?.signals.find((signal) => signal.id === "sector")?.status, "red");
  assert.equal(tungsten?.signals.find((signal) => signal.id === "earnings")?.status, "red");
  assert.equal(tungsten?.signals.find((signal) => signal.id === "minor-metals")?.status, "red");
});

test("manual snapshot includes every configured holding", () => {
  const snapshot = buildManualSnapshot(
    {
      quotes: {
        "chip-etf": { changePct: -1.2, turnoverRate: 2.4 }
      },
      marginHeat: {
        "chip-etf": { heat: "cool" }
      }
    },
    new Date("2026-06-26T10:00:00+08:00"),
    [customHolding]
  );

  assert.equal(snapshot.quotes["chip-etf"].changePct, -1.2);
  assert.equal(snapshot.marginHeat["chip-etf"].heat, "cool");
});

test("custom holdings receive generic observation signals", () => {
  const snapshot = buildManualSnapshot(
    {
      quotes: {
        "chip-etf": { changePct: -2.6, turnoverRate: 7.3 }
      },
      marginHeat: {
        "chip-etf": { heat: "normal" }
      }
    },
    new Date("2026-06-26T10:00:00+08:00"),
    [customHolding]
  );

  const profiles = buildProfilesFromSnapshot(snapshot, [customHolding]);
  const chip = profiles.find((profile) => profile.holding.id === "chip-etf");

  assert.equal(chip?.holding.name, "芯片ETF");
  assert.equal(chip?.signals.find((signal) => signal.id === "price-action")?.status, "yellow");
  assert.ok(chip?.nextWatch.some((item) => item.includes("芯片ETF")));
});

test("real data mode reports unavailable providers and falls back to cached data", async () => {
  const cached = buildManualSnapshot(
    {
      quotes: {
        "chip-etf": { changePct: 0.8, turnoverRate: 1.9 }
      }
    },
    new Date("2026-06-26T10:00:00+08:00"),
    [customHolding]
  );

  const snapshot = await loadSnapshot("real", testScenario, {}, [customHolding], cached);

  assert.equal(snapshot.quotes["chip-etf"].changePct, 0.8);
  assert.equal(snapshot.stale, true);
  assert.equal(snapshot.providerStatus?.some((status) => status.status === "disabled"), true);
});

test("real data mode uses configured quote client when available", async () => {
  const snapshot = await loadSnapshot("real", testScenario, {}, [customHolding], undefined, {
    fetchQuotes: async () => [
      {
        code: "159995",
        name: "芯片ETF华夏",
        price: 3.127,
        changePct: -1.51,
        turnoverRate: 7.6,
        updatedAt: "2026-06-26T10:00:00+08:00"
      }
    ]
  });

  assert.equal(snapshot.source, "real");
  assert.equal(snapshot.stale, false);
  assert.equal(snapshot.quotes["chip-etf"].price, 3.127);
  assert.equal(snapshot.quotes["chip-etf"].name, "芯片ETF华夏");
});
