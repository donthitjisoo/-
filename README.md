# 股票推薦追蹤系統

這個系統的核心是：CSV 是推薦紀錄來源，市場資料與績效追蹤由系統自動補齊。

推薦資料不從 UI 手動新增，也不靠 realtime 後端。新的推薦只能透過每個 watchlist 重新匯入固定格式 CSV。

## CSV 格式

CSV 欄位固定，不能改名：

```csv
date,symbol,target_price,recommender,target_reached,reached_days
2026-05-22,2330,1180,Tom,false,
2026-05-22,3661,520,Alice,true,7
```

匯入後，系統會自動補：

- 現在股價
- 推薦當時股價
- EPS
- PE
- Forward PE
- 推薦時價差 %
- 現在距離目標價 %
- 潛在報酬 %
- 即時報酬 %
- 已經過幾個交易日
- 是否已達標

## 達標邏輯

CSV 原本已達標：

- 保留 `target_reached=true`
- 保留第一次 `reached_days`
- 不覆蓋

CSV 原本未達標：

- 每次載入最新市場資料後重新判斷
- 若現在股價或推薦日後歷史高點已達目標價，顯示已達標
- `reached_days` 以推薦日起算的交易日數計算

## Data Flow

```txt
CSV
  ↓
normalize
  ↓
market data enrichment
  ↓
local state
  ↓
metrics engine
  ↓
table + dashboard analytics
```

## Daily Update

GitHub Actions 每日/盤中更新靜態市場資料：

- TWSE OpenAPI
- TPEx OpenAPI
- Yahoo Finance historical prices
- fundamentals seed

前端只讀：

- `data/stocks.json`
- `data/fundamentals.json`
- `data/history.json`

不使用 websocket、realtime streaming、reconnect logic 或 polling。

## Watchlists

支援多個 watchlists，例如：

- AI
- 高股息
- 醫療
- 半導體
- 短線
- 波段

每個 watchlist 可獨立匯入 CSV、搜尋、排序、匯出 CSV、統計 Dashboard。

## Local Development

```bash
npm install
npm run update:data
npm run build
npm run dev
```

GitHub Pages branch-root 也會同步 build artifact 到：

- `index.html`
- `assets/`
- `data/`
