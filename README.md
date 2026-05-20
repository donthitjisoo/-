# 飆股追蹤器

這是一個可部署到 GitHub Pages 的靜態網頁試算表，用來追蹤台股觀察清單、即時報價、觀察價與筆記。

## 使用方式

1. 開啟 `index.html`。
2. 輸入股票代號、名稱與觀察價。
3. 點選「更新報價」取得報價。
4. 使用「匯出 CSV」備份資料，或用「匯入 CSV」把舊資料帶進來。

資料會存在目前瀏覽器的 `localStorage`，不需要後端資料庫。

## GitHub Pages 部署

1. 將本資料夾推到 GitHub repository。
2. 到 repository 的 `Settings` → `Pages`。
3. Source 選 `Deploy from a branch`。
4. Branch 選 `main`，folder 選 `/root`。
5. 儲存後等待 GitHub Pages 產生網址。

## 自動更新報價

瀏覽器直接讀即時報價可能會被 CORS 擋住，所以專案同時支援前端即時抓取與 GitHub Actions 快取：

- `.github/workflows/update-quotes.yml`：台股交易日約每 5 分鐘更新一次。
- `scripts/fetch-quotes.mjs`：讀取 `watchlist.json`，依序嘗試 TWSE MIS 與 Yahoo Finance，抓取報價後寫入 `quotes.json`。
- `quotes.json`：網頁會在直接抓報價失敗時讀取這個快取檔。

要調整雲端追蹤清單，請編輯 `watchlist.json` 後推上 GitHub。網頁上的「加入」會存在個人瀏覽器，適合臨時觀察；若要讓 GitHub Actions 也更新該股票，仍需把代號加入 `watchlist.json`。

## CSV 欄位

匯入 CSV 建議使用以下欄位：

```csv
code,name,target,note
2330,台積電,1000,核心持股
2454,聯發科,,觀察突破
```

## 資料源提醒

目前前端會依序嘗試 TWSE MIS 與 Yahoo Finance chart JSON，失敗時改讀 GitHub Actions 產生的 `quotes.json`。這適合作為個人追蹤工具的起點；如果要公開提供多人自動更新，需確認交易所與資料平台的授權、流量限制與資料延遲規範，或改接正式市場資料供應商。
