# 飆股推薦追蹤 Dashboard

這個專案已改成 **Cloudflare Pages + GitHub Actions + 靜態資料架構**。

不使用 Vercel、不使用 database、不使用 websocket、不使用 server、不使用 realtime streaming。  
CSV 是唯一推薦來源，GitHub Actions 每日更新市場資料並輸出靜態 JSON，Cloudflare Pages 只部署 React/Vite 產出的 `dist/`。

## 架構

```txt
GitHub Repo
  ↓
data/**/*.csv
  ↓
GitHub Actions: npm run update:data
  ↓
public/data/*.json
  ↓
Cloudflare Pages: npm run build
  ↓
dist/
```

前端只讀：

- `public/data/stocks.json`
- `public/data/analytics.json`
- `public/data/leaderboard.json`
- `public/data/history.json`

## CSV 格式

推薦 CSV 格式固定：

```csv
date,symbol,target_price,recommender,target_reached,reached_days
2026-05-22,2330,1180,Tom,false,
2026-05-22,3661,520,Alice,true,7
```

主推薦來源：

```txt
data/recommendations.csv
```

多 watchlists：

```txt
data/watchlists/AI.csv
data/watchlists/半導體.csv
```

新的股票只能透過修改 CSV 新增。系統不會自動新增推薦股票，也不會同步外部 watchlist。

## 每日更新

`.github/workflows/update-data.yml` 會在台灣時間週一到週五 15:10 自動執行，也可以在 GitHub Actions 手動 Run workflow。

流程：

1. `npm ci`
2. `npm run update:data`
3. 查詢上市/上櫃、Yahoo ticker、股價、EPS、PE、Forward PE
4. 計算推薦衍生欄位與 dashboard analytics
5. 產生 `public/data/*.json`
6. `npm run build`
7. commit 產生後的 JSON 回 repo
8. Cloudflare Pages 因 main branch push 自動部署

## 達標邏輯

如果：

- `current_price >= target_price`
- 且 CSV 原本 `target_reached = false`

則輸出 JSON 時：

- `targetReached = true`
- `reachedDays = 從推薦日至今天的交易日數`

如果 CSV 原本已達標：

- 不覆蓋 `reached_days`
- 保留第一次達標紀錄

## 前端功能

- 深色 / 淺色模式
- 多 watchlists tabs
- Table view
- Search
- Filtering
- Sorting
- CSV Upload，本地預覽用
- Export CSV
- Analytics dashboard
- Leaderboard

前端不做大量金融計算。`analytics.json` 和 `leaderboard.json` 由 GitHub Actions 預先產生，React 只負責 render。

## 本機開發

```bash
npm install
npm run update:data
npm run dev
```

開啟：

```txt
http://127.0.0.1:5173
```

Production build：

```bash
npm run build
npm run preview
```

## Cloudflare Pages 設定

Cloudflare 官方文件列出的 React/Vite 設定是：

- Build command：`npm run build`
- Build output directory：`dist`

設定步驟：

1. 到 Cloudflare Dashboard
2. 進入 Workers & Pages
3. Create application
4. Pages
5. Connect to Git
6. 選擇你的 GitHub repo
7. Framework preset 選 `React (Vite)`
8. Build command 填 `npm run build`
9. Build output directory 填 `dist`
10. Production branch 選 `main`
11. Deploy

Cloudflare Pages GitHub integration 會在你 push 到 connected branch 時自動部署。

官方參考：

- Cloudflare Pages build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Cloudflare Pages GitHub integration: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- Cloudflare Pages Git integration guide: https://developers.cloudflare.com/pages/get-started/git-integration/

## GitHub Actions 設定

這個專案不需要 secrets 就能跑。

如果之後要換成正式付費股價 API，可以在 GitHub repo：

```txt
Settings → Secrets and variables → Actions
```

新增：

```bash
MARKET_DATA_API_KEY=
```

目前 `.env.example` 只保留這個 optional 範例。

## 免費部署流程

1. 在 Google Sheets 或 Excel 編輯推薦資料
2. 下載成 CSV
3. 覆蓋 `data/recommendations.csv` 或 `data/watchlists/*.csv`
4. push 到 GitHub main
5. GitHub Actions 更新 `public/data/*.json`
6. Cloudflare Pages 自動部署 `dist/`

## 重要檔案

- `scripts/update-data.mjs`：每日資料更新 pipeline
- `data/recommendations.csv`：主要推薦 CSV
- `data/watchlists/*.csv`：多 watchlists
- `public/data/stocks.json`：前端主要表格資料
- `public/data/analytics.json`：Dashboard 指標
- `public/data/leaderboard.json`：推薦人排行榜
- `public/data/history.json`：歷史價格
- `src/App.tsx`：靜態 Dashboard UI
