import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManualSnapshot } from "./dataProviders";
import { buildEastmoneyQuoteUrl, eastmoneySecidForCode, mergeRealQuotesIntoSnapshot } from "./realMarketData";
import type { Holding, RealQuotePoint } from "./types";

const holding: Holding = {
  id: "user-holding-a",
  name: "用户持仓A",
  code: "123456",
  positionRatio: 1,
  costNote: "用户添加",
  thesis: "用户自定义观察逻辑",
  horizon: "观察"
};

test("eastmoney secid maps common numeric prefixes", () => {
  assert.equal(eastmoneySecidForCode("123456"), "0.123456");
  assert.equal(eastmoneySecidForCode("600000"), "1.600000");
  assert.equal(eastmoneySecidForCode("688000"), "1.688000");
  assert.equal(eastmoneySecidForCode("900000"), "1.900000");
});

test("eastmoney quote url keeps only valid stock codes", () => {
  const url = buildEastmoneyQuoteUrl(["123456", "", "bad-code", "600000"]);

  assert.match(url, /secids=0\.123456%2C1\.600000/);
  assert.doesNotMatch(url, /bad-code/);
});

test("real quotes update snapshot values and provider status", () => {
  const snapshot = buildManualSnapshot({}, new Date("2026-06-26T10:00:00+08:00"), [holding]);
  const quote: RealQuotePoint = {
    code: "123456",
    name: "测试实时名称",
    price: 3.127,
    changePct: -1.51,
    turnoverRate: 3.72,
    updatedAt: "2026-06-26T10:01:00+08:00"
  };

  const merged = mergeRealQuotesIntoSnapshot(snapshot, [holding], [quote], new Date("2026-06-26T10:02:00+08:00"));

  assert.equal(merged.source, "real");
  assert.equal(merged.stale, false);
  assert.equal(merged.quotes["user-holding-a"].price, 3.127);
  assert.equal(merged.quotes["user-holding-a"].name, "测试实时名称");
  assert.equal(merged.providerStatus?.find((status) => status.id === "quote")?.status, "ok");
});
