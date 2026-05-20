import { readFile, writeFile } from "node:fs/promises";

const watchlist = JSON.parse(await readFile(new URL("../watchlist.json", import.meta.url), "utf8"));
const watchedCodes = uniqueCodes(watchlist.map((stock) => stock.code));
const dailyQuotes = await fetchDailyQuotes();
const quoteMap = new Map(dailyQuotes.map((quote) => [quote.code, quote]));

if (watchedCodes.length > 0) {
  const liveQuotes = await fetchLiveQuotes(watchedCodes);
  liveQuotes.forEach((quote, code) => quoteMap.set(code, { ...quoteMap.get(code), ...quote }));
}

await writeQuotes([...quoteMap.values()].sort((a, b) => a.code.localeCompare(b.code)), "TWSE/TPEx daily + watched live");

async function fetchDailyQuotes() {
  const [listed, otc] = await Promise.all([fetchListedDaily(), fetchOtcDaily()]);
  return [...listed, ...otc].filter((quote) => /^\d{4}$/.test(quote.code));
}

async function fetchListedDaily() {
  const response = await fetchJson("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");
  return response
    .map((item) => {
      const last = cleanPrice(item.ClosingPrice);
      const previous = numberOrNull(item.OpeningPrice);
      const changePercent = previous && last ? ((last - previous) / previous) * 100 : null;
      return {
        code: String(item.Code || "").trim(),
        name: String(item.Name || "").trim(),
        last,
        changePercent,
        volume: numberOrNull(item.TradeVolume),
        open: cleanPrice(item.OpeningPrice),
        high: cleanPrice(item.HighestPrice),
        low: cleanPrice(item.LowestPrice),
        time: String(item.Date || "").trim(),
        source: "TWSE 日行情"
      };
    })
    .filter((quote) => quote.code && quote.name && quote.last !== null);
}

async function fetchOtcDaily() {
  const response = await fetchJson("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes");
  return response
    .map((item) => {
      const last = cleanPrice(item.Close);
      const previous = numberOrNull(item.Open);
      const changePercent = previous && last ? ((last - previous) / previous) * 100 : null;
      return {
        code: String(item.SecuritiesCompanyCode || "").trim(),
        name: String(item.CompanyName || "").trim(),
        last,
        changePercent,
        volume: numberOrNull(item.TradingShares),
        open: cleanPrice(item.Open),
        high: cleanPrice(item.High),
        low: cleanPrice(item.Low),
        time: String(item.Date || "").trim(),
        source: "TPEx 日行情"
      };
    })
    .filter((quote) => quote.code && quote.name && quote.last !== null);
}

async function fetchLiveQuotes(stockCodes) {
  const providers = [
    { name: "TWSE MIS", fetchQuotes: fetchTwseQuotes },
    { name: "Yahoo Finance", fetchQuotes: fetchYahooQuotes }
  ];
  const quotes = new Map();

  for (const provider of providers) {
    const missingCodes = stockCodes.filter((code) => !quotes.has(code));
    if (missingCodes.length === 0) break;

    try {
      const providerQuotes = await provider.fetchQuotes(missingCodes);
      providerQuotes.forEach((quote, code) => {
        if (!quotes.has(code)) quotes.set(code, quote);
      });
    } catch (error) {
      console.warn(`${provider.name} failed: ${error.message}`);
    }
  }

  return quotes;
}

async function fetchTwseQuotes(stockCodes) {
  const quotes = new Map();
  for (const group of chunk(stockCodes, 80)) {
    const channels = group.flatMap((code) => [`tse_${code}.tw`, `otc_${code}.tw`]).join("|");
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 stock-tracker/1.0",
        referer: "https://mis.twse.com.tw/stock/index.jsp"
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload.msgArray) ? payload.msgArray : [];
    items.map(toTwseQuote).filter((quote) => quote.code).forEach((quote) => quotes.set(quote.code, quote));
  }
  return quotes;
}

async function fetchYahooQuotes(stockCodes) {
  const entries = await Promise.all(stockCodes.map(fetchYahooQuote));
  return new Map(entries.filter(Boolean).map((quote) => [quote.code, quote]));
}

async function fetchYahooQuote(code) {
  for (const suffix of [".TW", ".TWO"]) {
    const quote = await fetchYahooSymbol(code, `${code}${suffix}`);
    if (quote) return quote;
  }
  return null;
}

async function fetchYahooSymbol(code, symbol) {
  let payload = null;

  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 stock-tracker/1.0"
      }
    });
    if (!response.ok) continue;

    payload = await response.json();
    break;
  }

  if (!payload) return null;

  const result = payload?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const close = lastNumber(quote.close);
  const last = numberOrNull(meta.regularMarketPrice) ?? close;
  if (last === null) return null;

  const previous = numberOrNull(meta.chartPreviousClose) ?? numberOrNull(meta.previousClose);
  const changePercent = previous ? ((last - previous) / previous) * 100 : null;
  const timestamp = lastNumber(result.timestamp);

  return {
    code,
    name: meta.shortName || meta.symbol || "",
    last,
    changePercent,
    volume: numberOrNull(meta.regularMarketVolume) ?? lastNumber(quote.volume),
    open: firstNumber(quote.open),
    high: maxNumber(quote.high),
    low: minNumber(quote.low),
    time: timestamp ? new Date(timestamp * 1000).toISOString() : "",
    source: "Yahoo Finance"
  };
}

function toTwseQuote(item) {
  const last = firstValid(item.z, item.a?.split("_")[0], item.b?.split("_")[0], item.y);
  const previous = numberOrNull(item.y);
  const latest = numberOrNull(last);
  const changePercent = previous && latest ? ((latest - previous) / previous) * 100 : null;
  return {
    code: item.c || "",
    name: item.n || "",
    last,
    changePercent,
    volume: numberOrNull(item.v),
    open: firstValid(item.o),
    high: firstValid(item.h),
    low: firstValid(item.l),
    time: `${item.d || ""} ${item.t || ""}`.trim(),
    source: "TWSE MIS"
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 stock-tracker/1.0"
    }
  });
  if (!response.ok) throw new Error(`${url} failed: HTTP ${response.status}`);
  return response.json();
}

async function writeQuotes(quotes, source) {
  await writeFile(
    new URL("../quotes.json", import.meta.url),
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        source: `${source} via GitHub Actions`,
        quotes
      },
      null,
      2
    )}\n`
  );
}

function uniqueCodes(values) {
  return [...new Set(values.map((value) => String(value || "").match(/\d{4,6}/)?.[0]).filter(Boolean))];
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function cleanPrice(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text || text === "--") return null;
  return numberOrNull(text);
}

function firstValid(...values) {
  return values.find((value) => value && value !== "-" && value !== "_") || "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function firstNumber(values = []) {
  return values.map(numberOrNull).find((value) => value !== null) ?? null;
}

function lastNumber(values = []) {
  return [...values].reverse().map(numberOrNull).find((value) => value !== null) ?? null;
}

function maxNumber(values = []) {
  const numbers = values.map(numberOrNull).filter((value) => value !== null);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function minNumber(values = []) {
  const numbers = values.map(numberOrNull).filter((value) => value !== null);
  return numbers.length > 0 ? Math.min(...numbers) : null;
}
