import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManualSnapshot } from "./dataProviders";
import { buildEastmoneyQuoteUrl, eastmoneySecidForCode, mergeRealQuotesIntoSnapshot } from "./realMarketData";
import type { Holding, RealQuotePoint } from "./types";

const holding: Holding = {
  id: "chip-etf",
  name: "芯片ETF",
  code: "159995",
  positionRatio: 1,
  costNote: "观察仓",
  thesis: "半导体景气度 + 国产替代 + 组合分散观察位",
  horizon: "观察"
};

test("eastmoney secid matches common A-share and ETF markets", () => {
  assert.equal(eastmoneySecidForCode("000001"), "0.000001");
  assert.equal(eastmoneySecidForCode("159995"), "0.159995");
  assert.equal(eastmoneySecidForCode("600519"), "1.600519");
  assert.equal(eastmoneySecidForCode("688981"), "1.688981");
  assert.equal(eastmoneySecidForCode("512760"), "1.512760");
});

test("eastmoney quote url keeps only valid stock codes", () => {
  const url = buildEastmoneyQuoteUrl(["000001", "", "bad-code", "600519"]);

  assert.match(url, /secids=0\.000001%2C1\.600519/);
  assert.doesNotMatch(url, /bad-code/);
});

test("real quotes update snapshot values and provider status", () => {
  const snapshot = buildManualSnapshot({}, new Date("2026-06-26T10:00:00+08:00"), [holding]);
  const quote: RealQuotePoint = {
    code: "159995",
    name: "芯片ETF华夏",
    price: 3.127,
    changePct: -1.51,
    turnoverRate: 3.72,
    updatedAt: "2026-06-26T10:01:00+08:00"
  };

  const merged = mergeRealQuotesIntoSnapshot(snapshot, [holding], [quote], new Date("2026-06-26T10:02:00+08:00"));

  assert.equal(merged.source, "real");
  assert.equal(merged.stale, false);
  assert.equal(merged.quotes["chip-etf"].price, 3.127);
  assert.equal(merged.quotes["chip-etf"].name, "芯片ETF华夏");
  assert.equal(merged.providerStatus?.find((status) => status.id === "quote")?.status, "ok");
});
