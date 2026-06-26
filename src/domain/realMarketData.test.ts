import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEastmoneyQuoteUrl, eastmoneySecidForCode, mergeRealQuotesIntoSnapshot } from "./realMarketData";
import { buildManualSnapshot } from "./dataProviders";
import type { Holding, RealQuotePoint } from "./types";

const holding: Holding = {
  id: "hunan-gold",
  name: "湖南黄金",
  code: "002155",
  positionRatio: 59,
  costNote: "观察仓",
  thesis: "黄金避险 + 锑资源稀缺 + 重组预期",
  horizon: "中线"
};

test("eastmoney secid matches common A-share and ETF markets", () => {
  assert.equal(eastmoneySecidForCode("002155"), "0.002155");
  assert.equal(eastmoneySecidForCode("000657"), "0.000657");
  assert.equal(eastmoneySecidForCode("159995"), "0.159995");
  assert.equal(eastmoneySecidForCode("600519"), "1.600519");
  assert.equal(eastmoneySecidForCode("688981"), "1.688981");
  assert.equal(eastmoneySecidForCode("512760"), "1.512760");
});

test("eastmoney quote url keeps only valid stock codes", () => {
  const url = buildEastmoneyQuoteUrl(["002155", "", "bad-code", "600519"]);

  assert.match(url, /secids=0\.002155%2C1\.600519/);
  assert.doesNotMatch(url, /bad-code/);
});

test("real quotes update snapshot values and provider status", () => {
  const snapshot = buildManualSnapshot({}, new Date("2026-06-26T10:00:00+08:00"), [holding]);
  const quote: RealQuotePoint = {
    code: "002155",
    name: "湖南黄金",
    price: 24.24,
    changePct: -5.5,
    turnoverRate: 3.72,
    updatedAt: "2026-06-26T10:01:00+08:00"
  };

  const merged = mergeRealQuotesIntoSnapshot(snapshot, [holding], [quote], new Date("2026-06-26T10:02:00+08:00"));

  assert.equal(merged.source, "real");
  assert.equal(merged.stale, false);
  assert.equal(merged.quotes["hunan-gold"].price, 24.24);
  assert.equal(merged.quotes["hunan-gold"].name, "湖南黄金");
  assert.equal(merged.providerStatus?.find((status) => status.id === "quote")?.status, "ok");
});
