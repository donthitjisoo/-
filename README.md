# 飆股分析平台

這是一個適合 GitHub Pages + GitHub Actions 的靜態 FinTech 股票分析平台。React 只讀靜態 JSON，所有外部 API 抓取、normalization、fundamentals 合併、history 產生都由 GitHub Actions pipeline 完成。

## Architecture

```txt
External APIs
  ↓
GitHub Actions
  ↓
scripts/update-data.mjs
  ↓
public/data/*.json
  ↓
React services
  ↓
metrics engine
  ↓
virtualized analytics table
```

主要目錄：

- `src/types`：Stock domain model 與 analytics types
- `src/lib`：financial calculations、metrics engine、recommendation analytics
- `src/services`：static JSON loading 與 response normalization
- `src/hooks`：local sheets、stock data、derived rows、virtual rows
- `src/features/stock-table`：股票分析表格 feature
- `data/fundamentals`：fundamentals source layer
- `public/data`：GitHub Actions 產生的靜態資料

## Data Pipeline

```bash
npm run update:data
```

會產生：

- `public/data/stocks.json`
- `public/data/fundamentals.json`
- `public/data/history.json`
- `public/data/recommendation-analytics.json`
- `quotes.json` compatibility cache

GitHub Actions workflow：

- `.github/workflows/update-data.yml`
- 抓 TWSE OpenAPI
- 抓 TPEx OpenAPI
- 對 `watchlist.json` 股票補 MIS/Yahoo live quotes
- 合併 fundamentals
- 產生 static JSON
- build Vite app
- deploy GitHub Pages

## Local Development

```bash
npm install
npm run update:data
npm run dev
```

Production build：

```bash
npm run build
```

## Financial Metrics

`calculateStockMetrics(stock)` 會集中計算：

- distanceToTarget
- potentialReturn
- recommendationReturn
- recommendationUpside
- daysToTarget
- PE
- forward PE
- EPS estimate
- riskReward
- momentumScore

React table 不直接寫公式，只讀 `row.metrics`。
