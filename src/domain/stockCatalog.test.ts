import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStockMetadata } from "./stockCatalog";

test("known stock codes auto-fill display name and holding thesis", () => {
  const hunanGold = resolveStockMetadata("002155");
  const tungsten = resolveStockMetadata("000657");
  const chipEtf = resolveStockMetadata("159995");

  assert.equal(hunanGold.name, "湖南黄金");
  assert.match(hunanGold.thesis, /黄金/);
  assert.equal(tungsten.name, "中钨高新");
  assert.match(tungsten.thesis, /钨/);
  assert.equal(chipEtf.name, "芯片ETF");
});

test("unknown stock codes still produce a neutral observation profile", () => {
  const metadata = resolveStockMetadata("TEST01");

  assert.equal(metadata.name, "TEST01观察仓");
  assert.match(metadata.thesis, /等待真实数据/);
});
