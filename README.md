# 飆股追蹤器

這是一個可部署到 GitHub Pages 的靜態網頁試算表，用來追蹤多個台股選股清單、報價、目標價、評等與筆記。

## 使用方式

1. 開啟 `index.html`。
2. 建立或切換選股清單。
3. 輸入股票代號或名稱、目標價與評等。
4. 股票名稱、成交價、漲跌幅、總量、開高低會從 `quotes.json` 自動帶入。
5. 使用「匯出 CSV」備份資料，或用「匯入 CSV」把舊資料帶進來。

資料會存在目前瀏覽器的 `localStorage`，不需要後端資料庫。

## GitHub Pages 部署

1. 將本資料夾推到 GitHub repository。
2. 到 repository 的 `Settings` → `Pages`。
3. Source 選 `Deploy from a branch`。
4. Branch 選 `main`，folder 選 `/root`。
5. 儲存後等待 GitHub Pages 產生網址。

## 自動更新報價

瀏覽器直接讀即時報價可能會被 CORS 擋住，所以專案以 GitHub Actions 快取為主：

- `.github/workflows/update-quotes.yml`：台股交易日約每 5 分鐘更新一次。
- `scripts/fetch-quotes.mjs`：抓取 TWSE/TPEx 全市場四碼股票日行情，並用 `watchlist.json` 內股票的即時報價覆蓋。
- `quotes.json`：網頁讀取這個快取檔，自動補股票名稱與成交、開高低。

網頁上的選股清單會存在個人瀏覽器。若希望某些股票在盤中優先用較新的 MIS/Yahoo 報價覆蓋日行情，請把代號加入 `watchlist.json` 後推上 GitHub。

## CSV 欄位

匯入 CSV 建議使用以下欄位：

```csv
code,target,rating,note
2330,1000,買進,核心持股
2454,,觀察,觀察突破
```

## 資料源提醒

目前網頁讀取 GitHub Actions 產生的 `quotes.json`。這適合作為個人追蹤工具的起點；如果要公開提供多人自動更新，需確認交易所與資料平台的授權、流量限制與資料延遲規範，或改接正式市場資料供應商。
