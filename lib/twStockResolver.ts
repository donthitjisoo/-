import "server-only";

import type { TaiwanTicker, TaiwanMarket } from "./types";

const FALLBACK_TICKERS: Record<string, TaiwanTicker> = {
  "2330": ticker("2330", "2330.TW", "TWSE", "上市", "台積電"),
  "2317": ticker("2317", "2317.TW", "TWSE", "上市", "鴻海"),
  "2454": ticker("2454", "2454.TW", "TWSE", "上市", "聯發科"),
  "2327": ticker("2327", "2327.TW", "TWSE", "上市", "國巨"),
  "2308": ticker("2308", "2308.TW", "TWSE", "上市", "台達電"),
  "3661": ticker("3661", "3661.TWO", "TPEX", "上櫃", "世芯-KY"),
  "3163": ticker("3163", "3163.TWO", "TPEX", "上櫃", "波若威"),
  "6488": ticker("6488", "6488.TWO", "TPEX", "上櫃", "環球晶")
};

let cache: Map<string, TaiwanTicker> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function resolveTaiwanTicker(symbolInput: string): Promise<TaiwanTicker> {
  const symbol = normalizeSymbol(symbolInput);
  const tickers = await loadTickerCache();
  return tickers.get(symbol) || fallbackUnknown(symbol);
}

export async function resolveTaiwanTickers(symbols: string[]) {
  const unique = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  const entries = await Promise.all(unique.map(async (symbol) => [symbol, await resolveTaiwanTicker(symbol)] as const));
  return Object.fromEntries(entries);
}

function normalizeSymbol(symbol: string) {
  return String(symbol || "").match(/\d{4,6}/)?.[0] || "";
}

async function loadTickerCache() {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;

  const next = new Map<string, TaiwanTicker>(Object.entries(FALLBACK_TICKERS));
  await Promise.allSettled([loadTwseTickers(next), loadTpexTickers(next)]);
  cache = next;
  cacheLoadedAt = Date.now();
  return next;
}

async function loadTwseTickers(target: Map<string, TaiwanTicker>) {
  const response = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", { next: { revalidate: 86400 } });
  if (!response.ok) return;
  const data = (await response.json()) as Array<Record<string, string>>;
  for (const row of data) {
    const symbol = row.Code || row["證券代號"];
    const name = row.Name || row["證券名稱"];
    if (symbol) target.set(symbol, ticker(symbol, `${symbol}.TW`, "TWSE", "上市", name));
  }
}

async function loadTpexTickers(target: Map<string, TaiwanTicker>) {
  const response = await fetch("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes", { next: { revalidate: 86400 } });
  if (!response.ok) return;
  const data = (await response.json()) as Array<Record<string, string>>;
  for (const row of data) {
    const symbol = row.SecuritiesCompanyCode || row.Code || row["代號"];
    const name = row.CompanyName || row.Name || row["名稱"];
    if (symbol) target.set(symbol, ticker(symbol, `${symbol}.TWO`, "TPEX", "上櫃", name));
  }
}

function fallbackUnknown(symbol: string): TaiwanTicker {
  return ticker(symbol, `${symbol}.TW`, "UNKNOWN", "未知");
}

function ticker(symbol: string, yahooSymbol: string, market: TaiwanMarket, marketName: TaiwanTicker["marketName"], name?: string): TaiwanTicker {
  return { symbol, yahooSymbol, market, marketName, name };
}
