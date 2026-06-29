import type { Holding } from "./types";

export interface StockMetadata {
  code: string;
  name: string;
  thesis: string;
}

const stockCatalog: Record<string, Omit<StockMetadata, "code">> = {
  "159995": {
    name: "芯片ETF",
    thesis: "半导体景气度 + 国产替代 + 组合分散观察位"
  },
  "512760": {
    name: "芯片ETF",
    thesis: "半导体景气度 + 国产替代 + 组合分散观察位"
  }
};

export function resolveStockMetadata(code: string): StockMetadata {
  const normalizedCode = normalizeStockCode(code);
  const known = stockCatalog[normalizedCode];
  if (known) return { code: normalizedCode, ...known };

  if (!normalizedCode) {
    return {
      code: "",
      name: "待填写代码",
      thesis: "输入股票代码后，将由真实数据或本地目录自动补全名称和观察逻辑。"
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
