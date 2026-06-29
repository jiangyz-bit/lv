import assert from "node:assert/strict";
import test from "node:test";
import { createMockMarketDataProvider } from "./dataProviders";
import { holdings } from "./mockData";
import { resolveStockMetadata } from "./stockCatalog";

const removedIds = new Set([["hunan", "gold"].join("-"), ["china", "tungsten"].join("-")]);
const removedCodes = new Set([["002", "155"].join(""), ["000", "657"].join("")]);
const removedNames = [["\u6e56\u5357", "\u9ec4\u91d1"].join(""), ["\u4e2d\u94a8", "\u9ad8\u65b0"].join("")];

test("default project data does not include removed legacy holdings", async () => {
  const defaultIds = holdings.map((holding) => holding.id);
  const defaultCodes = holdings.map((holding) => holding.code);
  const defaultNames = holdings.map((holding) => holding.name);

  assert.equal(defaultIds.some((id) => removedIds.has(id)), false);
  assert.equal(defaultCodes.some((code) => removedCodes.has(code)), false);
  assert.equal(defaultNames.some((name) => removedNames.includes(name)), false);

  const snapshot = await createMockMarketDataProvider("cooling").getSnapshot();
  assert.equal(Object.keys(snapshot.quotes).some((id) => removedIds.has(id)), false);
  assert.equal(Object.keys(snapshot.marginHeat).some((id) => removedIds.has(id)), false);
  assert.equal(snapshot.announcements.some((item) => removedIds.has(item.stockId)), false);
});

test("removed stock codes no longer resolve to built-in catalog metadata", () => {
  assert.notEqual(resolveStockMetadata(["002", "155"].join("")).name, ["\u6e56\u5357", "\u9ec4\u91d1"].join(""));
  assert.notEqual(resolveStockMetadata(["000", "657"].join("")).name, ["\u4e2d\u94a8", "\u9ad8\u65b0"].join(""));
});
