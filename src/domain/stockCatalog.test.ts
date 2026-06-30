import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveStockMetadata } from "./stockCatalog";

test("stock catalog does not provide built-in stock metadata", () => {
  const metadata = resolveStockMetadata("123456");

  assert.equal(metadata.name, "123456观察位");
  assert.match(metadata.thesis, /等待真实数据/);
});

test("empty stock code produces an editable placeholder", () => {
  const metadata = resolveStockMetadata("");

  assert.equal(metadata.name, "待填写代码");
  assert.match(metadata.thesis, /输入股票代码/);
});
