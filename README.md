# 持仓逻辑宠物

Windows 桌面悬浮持仓陪伴宠物，重点看持仓逻辑是否还在、风险是否升温、组合是否过度集中。

它不是短线交易软件，不预测明天涨跌，也不会给机械买卖指令。

## 已有功能

- 桌面悬浮宠物：frameless、transparent、always on top，默认 520x720。
- 组合体检：识别资源仓位偏高、同涨同跌风险、现金缓冲需求。
- 数据接入架构：`MarketDataProvider` 接口支持行情、商品价格、公告/新闻、两融/融资热度。
- 数据模式：真实股票行情 + 内部缓存兜底；开发测试仍保留 mock/manual provider。
- 智能识别：支持 DeepSeek API，把股票代码/名称整理成中性的持仓观察逻辑。
- 主动提醒：事件触发 + 冷却机制 + 用户反馈降噪，并解释“为什么现在提醒”。
- Windows 体验：托盘菜单、隐藏/显示、最小化、置顶开关、开机自启配置入口、拖动窗口。
- 设置面板：红灯优先、安静模式、风险敏感度、持仓股票增删、演示场景切换、手动兜底录入。

## 数据边界

当前版本已接入新浪公开行情接口，能获取 A 股/ETF 的名称、现价、涨跌幅；商品价格、公告/新闻、两融热度仍保留为后续 provider：

- `electron/main.cjs`：通过主进程请求新浪行情，避免浏览器 CORS，并通过 preload 暴露给 React。
- `src/domain/dataProviders.ts`：provider 接口、real provider、mock/manual provider、缓存兜底、快照合并。
- `src/domain/realMarketData.ts`：真实行情快照合并、代码市场映射、provider 状态。
- `src/domain/scoring.ts`：把行情/商品/公告/两融快照映射成信号灯；新增股票会走通用观察公式。
- `src/domain/alertEngine.ts`：事件提醒、冷却、反馈降噪。
- DeepSeek Key 不写入源码。可在设置页保存，或在 `.env.local` 中配置 `DEEPSEEK_API_KEY`。

后续接商品价格、公告/新闻、两融数据时，只需要新增 provider，并输出同一个 `MarketSnapshot` 结构。

## 运行

```powershell
npm install
npm run dev
```

如果 Electron 提示安装不完整，可以先删除并重装 Electron 包：

```powershell
Remove-Item -LiteralPath .\node_modules\electron -Recurse -Force
npm install
```

## 构建与测试

```powershell
npm test
npm run build
```

## 使用提醒

提醒只用于复核中线持仓逻辑，例如商品价格是否同步转弱、融资热度是否过高、公司公告是否改变原假设、组合仓位是否过度集中。金融内容保持中性，不承诺收益。
