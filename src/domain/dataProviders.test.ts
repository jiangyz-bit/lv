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
  thesis: "用于分散组合的观察仓",
  horizon: "观察"
};

const concentratedHolding: Holding = {
  id: "core-observer",
  name: "核心观察位",
  code: "512760",
  positionRatio: 45,
  costNote: "测试仓位",
  thesis: "通用观察公式测试",
  horizon: "中线"
};

const testScenario: Scenario = {
  id: "cooling",
  label: "测试场景",
  description: "测试用",
  signalOverrides: {}
};

test("manual snapshot overrides provider values and keeps source metadata", async () => {
  const provider = createMockMarketDataProvider("cooling", [customHolding]);
  const providerSnapshot = await provider.getSnapshot();
  const manualSnapshot = buildManualSnapshot(
    {
      quotes: {
        "chip-etf": { changePct: -4.2, turnoverRate: 7.1 }
      },
      commodities: {
        minorMetals: { trend: "down", changePct: -3.1 }
      }
    },
    new Date("2026-06-26T10:00:00+08:00"),
    [customHolding]
  );

  const snapshot = mergeSnapshots(providerSnapshot, manualSnapshot);

  assert.equal(snapshot.source, "mock+manual");
  assert.equal(snapshot.quotes["chip-etf"].changePct, -4.2);
  assert.equal(snapshot.commodities.minorMetals.source, "manual");
});

test("snapshot values turn into generic holding-logic signal statuses", async () => {
  const provider = createMockMarketDataProvider("red-risk", [customHolding]);
  const profiles = buildProfilesFromSnapshot(await provider.getSnapshot(), [customHolding]);
  const chip = profiles.find((profile) => profile.holding.id === "chip-etf");

  assert.equal(chip?.signals.find((signal) => signal.id === "price-action")?.status, "red");
  assert.equal(chip?.signals.find((signal) => signal.id === "liquidity")?.status, "red");
});

test("manual announcements affect generic observation signals", () => {
  const snapshot = buildManualSnapshot(
    {
      announcements: [
        {
          id: "manual-chip-etf",
          stockId: "chip-etf",
          title: "手动：变量需要复核",
          tone: "negative",
          source: "manual",
          publishedAt: "2026-06-26T10:00:00+08:00"
        }
      ]
    },
    new Date("2026-06-26T10:00:00+08:00"),
    [customHolding]
  );

  const profiles = buildProfilesFromSnapshot(snapshot, [customHolding]);
  const chip = profiles.find((profile) => profile.holding.id === "chip-etf");

  assert.equal(chip?.signals.find((signal) => signal.id === "announcement")?.status, "red");
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

test("concentrated holdings receive portfolio-fit red signal", () => {
  const snapshot = buildManualSnapshot({}, new Date("2026-06-26T10:00:00+08:00"), [concentratedHolding]);
  const profiles = buildProfilesFromSnapshot(snapshot, [concentratedHolding]);
  const core = profiles.find((profile) => profile.holding.id === "core-observer");

  assert.equal(core?.signals.find((signal) => signal.id === "portfolio-fit")?.status, "red");
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
