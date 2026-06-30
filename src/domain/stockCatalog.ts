import type { Holding } from "./types";

export interface StockMetadata {
  code: string;
  name: string;
  thesis: string;
}

export function resolveStockMetadata(code: string): StockMetadata {
  const normalizedCode = normalizeStockCode(code);

  if (!normalizedCode) {
    return {
      code: "",
      name: "待填写代码",
      thesis: "输入股票代码后，可由真实数据接口或智能识别补全名称和观察逻辑。"
    };
  }

  return {
    code: normalizedCode,
    name: `${normalizedCode}观察位`,
    thesis: "等待真实数据接口返回股票名称；先按通用观察公式跟踪价格、成交、公告和组合集中度。"
  };
}

export function hydrateHoldingMetadata(holding: Holding): Holding {
  const metadata = resolveStockMetadata(holding.code);
  return {
    ...holding,
    code: metadata.code,
    name: metadata.name,
    thesis: metadata.thesis
  };
}

function normalizeStockCode(code: string): string {
  return code.trim().toUpperCase().replace(/^S[HZ]/, "");
}
