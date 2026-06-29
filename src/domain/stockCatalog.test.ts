import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStockMetadata } from "./stockCatalog";

test("known stock codes auto-fill display name and holding thesis", () => {
  const chipEtf = resolveStockMetadata("159995");

  assert.equal(chipEtf.name, "芯片ETF");
  assert.match(chipEtf.thesis, /半导体/);
});

test("unknown stock codes still produce a neutral observation profile", () => {
  const metadata = resolveStockMetadata("TEST01");

  assert.equal(metadata.name, "TEST01观察位");
  assert.match(metadata.thesis, /等待真实数据/);
});
