# 個人投資管理 Web App

Next.js 15 + TypeScript 投資管理 dashboard。Google Sheets 只保存原始資料，Next.js API Routes 負責讀寫資料、查詢台股報價、辨識上市/上櫃、計算持倉與推薦績效。

> 這個版本有後端 API Routes，因此不能只用 GitHub Pages 靜態部署。建議部署到 Vercel、Render、Fly.io，或任何可執行 Next.js server 的 Node.js 平台。

## 功能

- Dashboard：總資產、今日損益、未實現損益、持倉數量、推薦數量、已達標推薦
- 持倉 CRUD：新增、編輯、刪除後直接寫回 Google Sheets
- 推薦 CRUD：新增、編輯、刪除後直接寫回 Google Sheets
- 自動補齊股票名稱、現行股價、上市/上櫃、Yahoo ticker
- 自動計算推薦時差、當下潛在報酬、實時潛在報酬、是否達標、達標交易日
- 搜尋股票代號/名稱
- 推薦人、市場別、達標狀態篩選
- 依市值、未實現損益、潛在報酬排序

## Google Sheets 結構

請建立三個 tab，名稱與欄位必須一致：

### recommendations

```csv
id,date,symbol,target_price,recommended_price,recommender,note
rec_001,2026-05-22,2330,1180,950,Tom,AI server supply chain
```

### holdings

```csv
id,symbol,shares,avg_cost,broker,account,note
holding_001,2330,1000,850,富邦,主帳戶,核心持倉
```

### price_history

```csv
date,symbol,open,high,low,close,volume
2026-05-22,2330,950,990,945,980,45000000
```

完整範本在 [docs/google-sheets-template.md](./docs/google-sheets-template.md)。

## 環境變數

複製 `.env.example` 成 `.env.local`：

```bash
GOOGLE_SHEET_ID=你的試算表 ID
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Google Sheet 需要分享給 service account email，權限至少是 Editor。

如果沒有設定環境變數，App 會使用 `.local-data.json` demo fallback，方便本機直接測試 CRUD。

## 執行

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

## API

- `GET /api/dashboard`
- `GET /api/holdings`
- `POST /api/holdings`
- `PUT /api/holdings/:id`
- `DELETE /api/holdings/:id`
- `GET /api/recommendations`
- `POST /api/recommendations`
- `PUT /api/recommendations/:id`
- `DELETE /api/recommendations/:id`
- `GET /api/prices?symbols=2330,3661`

## 台股上市 / 上櫃辨識

`lib/twStockResolver.ts` 會優先用快取和內建常用股 fallback，再嘗試 TWSE/TPEX OpenAPI：

- 上市：`2330` → `2330.TW`
- 上櫃：`3661` → `3661.TWO`

解析結果格式：

```ts
{
  symbol: "3661",
  yahooSymbol: "3661.TWO",
  market: "TPEX",
  marketName: "上櫃"
}
```

## 模組

- `lib/googleSheets.ts`：Google Sheets 讀寫與本機 fallback
- `lib/priceProvider.ts`：報價 provider、cache、Yahoo Finance adapter
- `lib/twStockResolver.ts`：上市/上櫃辨識與 Yahoo ticker 轉換
- `lib/calculations.ts`：持倉與推薦績效計算
- `lib/investmentService.ts`：API 使用的 application service
- `lib/types.ts`：完整 TypeScript models
- `components/investment-dashboard.tsx`：Dashboard、篩選、CRUD UI

## 部署

Vercel 最簡單：

1. 匯入 GitHub repo
2. 設定三個環境變數
3. Deploy

其他 Node.js 平台：

```bash
npm run build
npm run start
```
