import { readFile, writeFile } from "node:fs/promises";

const watchlist = JSON.parse(await readFile(new URL("../watchlist.json", import.meta.url), "utf8"));
const codes = [...new Set(watchlist.map((stock) => String(stock.code || "").trim()).filter(Boolean))];

if (codes.length === 0) {
  await writeQuotes([], "none");
  process.exit(0);
}

const providers = [
  { name: "TWSE MIS", fetchQuotes: fetchTwseQuotes },
  { name: "Yahoo Finance", fetchQuotes: fetchYahooQuotes }
];
const quotes = new Map();
const sources = [];
const failures = [];

for (const provider of providers) {
  const missingCodes = codes.filter((code) => !quotes.has(code));
  if (missingCodes.length === 0) break;

  try {
    const providerQuotes = await provider.fetchQuotes(missingCodes);
    providerQuotes.forEach((quote, code) => {
      if (!quotes.has(code)) quotes.set(code, quote);
    });
    if (providerQuotes.size > 0) sources.push(provider.name);
  } catch (error) {
    failures.push(`${provider.name}: ${error.message}`);
  }
}

const quoteList = codes.map((code) => quotes.get(code)).filter(Boolean);

if (quoteList.length === 0 && failures.length > 0) {
  throw new Error(`All quote providers failed. ${failures.join(" | ")}`);
}

await writeQuotes(quoteList, sources.join(" + ") || "no live source");

async function fetchTwseQuotes(stockCodes) {
  const channels = stockCodes.flatMap((code) => [`tse_${code}.tw`, `otc_${code}.tw`]).join("|");
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Date.now()}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 stock-tracker/1.0",
      referer: "https://mis.twse.com.tw/stock/index.jsp"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.msgArray) ? payload.msgArray : [];
  return new Map(items.map(toTwseQuote).filter((quote) => quote.code).map((quote) => [quote.code, quote]));
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
