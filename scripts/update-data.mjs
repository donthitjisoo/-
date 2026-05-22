import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const watchlistDir = path.join(dataDir, "watchlists");
const outputDir = path.join(root, "public", "data");
const CSV_HEADERS = ["date", "symbol", "target_price", "recommender", "target_reached", "reached_days"];

const fallbackTickers = {
  "2330": ticker("2330", "2330.TW", "TWSE", "上市", "台積電"),
  "2317": ticker("2317", "2317.TW", "TWSE", "上市", "鴻海"),
  "2454": ticker("2454", "2454.TW", "TWSE", "上市", "聯發科"),
  "2327": ticker("2327", "2327.TW", "TWSE", "上市", "國巨"),
  "2308": ticker("2308", "2308.TW", "TWSE", "上市", "台達電"),
  "2882": ticker("2882", "2882.TW", "TWSE", "上市", "國泰金"),
  "3661": ticker("3661", "3661.TWO", "TPEX", "上櫃", "世芯-KY"),
  "3163": ticker("3163", "3163.TWO", "TPEX", "上櫃", "波若威"),
  "6488": ticker("6488", "6488.TWO", "TPEX", "上櫃", "環球晶")
};

await main();

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const watchlists = await readWatchlists();
  const symbols = [...new Set(watchlists.flatMap((watchlist) => watchlist.recommendations.map((row) => row.symbol)))];
  const tickerMap = await resolveTickers(symbols);
  const quoteMap = Object.fromEntries(await Promise.all(symbols.map(async (symbol) => [symbol, await fetchQuote(tickerMap[symbol])])));
  const historyMap = Object.fromEntries(await Promise.all(symbols.map(async (symbol) => [symbol, await fetchHistory(tickerMap[symbol], earliestDate(watchlists, symbol))])));

  const enrichedWatchlists = watchlists.map((watchlist) => ({
    ...watchlist,
    stocks: watchlist.recommendations.map((row) => enrichRecommendation(row, tickerMap[row.symbol], quoteMap[row.symbol], historyMap[row.symbol]))
  }));

  const stocks = enrichedWatchlists.flatMap((watchlist) => watchlist.stocks.map((stock) => ({ ...stock, watchlistId: watchlist.id, watchlistName: watchlist.name })));
  const analytics = calculateAnalytics(enrichedWatchlists);
  const leaderboard = calculateLeaderboard(stocks);
  const history = {
    generatedAt: new Date().toISOString(),
    symbols: historyMap
  };

  await writeJson("stocks.json", { generatedAt: new Date().toISOString(), watchlists: enrichedWatchlists, stocks });
  await writeJson("analytics.json", analytics);
  await writeJson("leaderboard.json", leaderboard);
  await writeJson("history.json", history);
  await writeJson("manifest.json", {
    generatedAt: new Date().toISOString(),
    files: ["stocks.json", "analytics.json", "leaderboard.json", "history.json"],
    source: "data/recommendations.csv"
  });
}

async function readWatchlists() {
  const watchlists = [];
  const defaultCsv = await readCsvFile(path.join(dataDir, "recommendations.csv"));
  watchlists.push({ id: "default", name: "總表", source: "data/recommendations.csv", recommendations: defaultCsv });

  const files = await fs.readdir(watchlistDir).catch(() => []);
  for (const file of files.filter((name) => name.endsWith(".csv")).sort()) {
    const filePath = path.join(watchlistDir, file);
    const name = path.basename(file, ".csv");
    watchlists.push({
      id: slug(name),
      name,
      source: `data/watchlists/${file}`,
      recommendations: await readCsvFile(filePath)
    });
  }
  return watchlists;
}

async function readCsvFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const rows = parseCsv(content);
  if (rows.length === 0) return [];
  const headers = rows[0].map((cell) => cell.trim().toLowerCase());
  const missing = CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`${filePath} 缺少欄位：${missing.join(", ")}`);
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));

  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row, index) => {
    const symbol = normalizeSymbol(row[indexes.symbol]);
    const targetPrice = Number(row[indexes.target_price]);
    if (!symbol) throw new Error(`${filePath} 第 ${index + 2} 列股票代號錯誤`);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw new Error(`${filePath} 第 ${index + 2} 列目標價錯誤`);
    return {
      id: `${symbol}-${row[indexes.date]}-${index}`,
      date: row[indexes.date]?.trim() || "",
      symbol,
      targetPrice,
      recommender: row[indexes.recommender]?.trim() || "",
      sourceTargetReached: parseBoolean(row[indexes.target_reached]),
      sourceReachedDays: optionalNumber(row[indexes.reached_days])
    };
  });
}

async function resolveTickers(symbols) {
  const tickers = { ...fallbackTickers };
  await Promise.allSettled([loadTwseTickers(tickers), loadTpexTickers(tickers)]);
  return Object.fromEntries(symbols.map((symbol) => [symbol, tickers[symbol] || ticker(symbol, `${symbol}.TW`, "UNKNOWN", "未知", symbol)]));
}

async function loadTwseTickers(target) {
  const response = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");
  if (!response.ok) return;
  const data = await response.json();
  for (const row of data) {
    const symbol = row.Code || row["證券代號"];
    const name = row.Name || row["證券名稱"];
    if (symbol) target[symbol] = ticker(symbol, `${symbol}.TW`, "TWSE", "上市", name);
  }
}

async function loadTpexTickers(target) {
  const response = await fetch("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes");
  if (!response.ok) return;
  const data = await response.json();
  for (const row of data) {
    const symbol = row.SecuritiesCompanyCode || row.Code || row["代號"];
    const name = row.CompanyName || row.Name || row["名稱"];
    if (symbol) target[symbol] = ticker(symbol, `${symbol}.TWO`, "TPEX", "上櫃", name);
  }
}

async function fetchQuote(resolved) {
  const [chart, fundamentals] = await Promise.allSettled([fetchYahooChart(resolved.yahooSymbol, "5d"), fetchFundamentals(resolved.yahooSymbol)]);
  const meta = chart.status === "fulfilled" ? chart.value.meta : {};
  const price = Number(meta.regularMarketPrice || meta.previousClose || 0);
  const previousClose = Number(meta.previousClose || 0);
  return {
    ...resolved,
    currentPrice: price,
    previousClose,
    change: price && previousClose ? price - previousClose : 0,
    changePercent: price && previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
    eps: fundamentals.status === "fulfilled" ? fundamentals.value.eps : null,
    pe: fundamentals.status === "fulfilled" ? fundamentals.value.pe : null,
    forwardPe: fundamentals.status === "fulfilled" ? fundamentals.value.forwardPe : null,
    updatedAt: new Date().toISOString()
  };
}

async function fetchHistory(resolved, fromDate) {
  const chart = await fetchYahooChart(resolved.yahooSymbol, "max", fromDate).catch(() => ({ rows: [] }));
  return chart.rows.map((row) => ({ ...row, symbol: resolved.symbol }));
}

async function fetchYahooChart(yahooSymbol, range, fromDate) {
  const params = fromDate
    ? `period1=${Math.floor(new Date(`${fromDate}T00:00:00+08:00`).getTime() / 1000)}&period2=${Math.floor(Date.now() / 1000)}`
    : `range=${range}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?${params}&interval=1d`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yahoo chart failed: ${yahooSymbol}`);
  const payload = await response.json();
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp || [];
  return {
    meta: result?.meta || {},
    rows: timestamps.map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: Number(quote?.open?.[index] || 0),
      high: Number(quote?.high?.[index] || 0),
      low: Number(quote?.low?.[index] || 0),
      close: Number(quote?.close?.[index] || 0),
      volume: Number(quote?.volume?.[index] || 0)
    })).filter((row) => row.close || row.high)
  };
}

async function fetchFundamentals(yahooSymbol) {
  const modules = "defaultKeyStatistics,summaryDetail,financialData";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=${modules}`;
  const response = await fetch(url);
  if (!response.ok) return { eps: null, pe: null, forwardPe: null };
  const result = (await response.json()).quoteSummary?.result?.[0] || {};
  return {
    eps: raw(result.defaultKeyStatistics?.trailingEps) ?? raw(result.financialData?.epsTrailingTwelveMonths),
    pe: raw(result.summaryDetail?.trailingPE),
    forwardPe: raw(result.summaryDetail?.forwardPE) ?? raw(result.defaultKeyStatistics?.forwardPE)
  };
}

function enrichRecommendation(row, resolved, quote, history) {
  const recommendedPrice = findCloseOnOrBefore(row.date, history) || quote.currentPrice || 0;
  const elapsedTradingDays = countTradingDays(row.date, history);
  const wasReached = row.sourceTargetReached;
  const targetReached = wasReached || quote.currentPrice >= row.targetPrice;
  const reachedDays = wasReached
    ? row.sourceReachedDays ?? firstReachedDays(row.date, row.targetPrice, history)
    : targetReached
      ? elapsedTradingDays
      : null;

  return {
    id: row.id,
    date: row.date,
    symbol: row.symbol,
    name: quote.name || resolved.name || row.symbol,
    market: quote.market,
    marketName: quote.marketName,
    yahooSymbol: quote.yahooSymbol,
    recommender: row.recommender,
    targetPrice: row.targetPrice,
    recommendedPrice,
    currentPrice: quote.currentPrice,
    eps: quote.eps,
    pe: quote.pe,
    forwardPe: quote.forwardPe,
    recommendationGapPct: pct(quote.currentPrice - recommendedPrice, recommendedPrice),
    distanceToTargetPct: pct(row.targetPrice - quote.currentPrice, quote.currentPrice),
    potentialReturnPct: pct(row.targetPrice - quote.currentPrice, quote.currentPrice),
    instantReturnPct: pct(quote.currentPrice - recommendedPrice, recommendedPrice),
    recommendationUpsidePct: pct(row.targetPrice - recommendedPrice, recommendedPrice),
    elapsedTradingDays,
    targetReached,
    reachedDays,
    sourceTargetReached: row.sourceTargetReached,
    sourceReachedDays: row.sourceReachedDays,
    updatedAt: quote.updatedAt
  };
}

function calculateAnalytics(watchlists) {
  const byWatchlist = Object.fromEntries(watchlists.map((watchlist) => [watchlist.id, summarize(watchlist.stocks)]));
  const all = watchlists.flatMap((watchlist) => watchlist.stocks);
  return {
    generatedAt: new Date().toISOString(),
    overall: summarize(all),
    byWatchlist
  };
}

function calculateLeaderboard(stocks) {
  const grouped = new Map();
  for (const stock of stocks) {
    if (!grouped.has(stock.recommender)) grouped.set(stock.recommender, []);
    grouped.get(stock.recommender).push(stock);
  }
  const recommenders = [...grouped.entries()].map(([recommender, rows]) => ({
    recommender,
    count: rows.length,
    targetReachedCount: rows.filter((row) => row.targetReached).length,
    hitRate: pct(rows.filter((row) => row.targetReached).length, rows.length),
    avgInstantReturn: avg(rows.map((row) => row.instantReturnPct)),
    avgPotentialReturn: avg(rows.map((row) => row.potentialReturnPct)),
    avgReachedDays: avg(rows.filter((row) => row.reachedDays !== null).map((row) => row.reachedDays))
  })).sort((a, b) => b.hitRate - a.hitRate || b.avgInstantReturn - a.avgInstantReturn);
  return { generatedAt: new Date().toISOString(), recommenders };
}

function summarize(rows) {
  const reached = rows.filter((row) => row.targetReached);
  return {
    count: rows.length,
    targetReachedCount: reached.length,
    targetRate: pct(reached.length, rows.length),
    avgReachedDays: avg(reached.map((row) => row.reachedDays).filter((value) => value !== null)),
    avgPotentialReturn: avg(rows.map((row) => row.potentialReturnPct)),
    avgInstantReturn: avg(rows.map((row) => row.instantReturnPct)),
    winRate: pct(rows.filter((row) => row.instantReturnPct > 0).length, rows.length),
    unreachedCount: rows.length - reached.length
  };
}

function findCloseOnOrBefore(date, history) {
  const rows = history.filter((row) => row.date <= date).sort((a, b) => b.date.localeCompare(a.date));
  return rows[0]?.close || null;
}

function countTradingDays(date, history) {
  return history.filter((row) => row.date >= date).length;
}

function firstReachedDays(date, targetPrice, history) {
  const rows = history.filter((row) => row.date >= date).sort((a, b) => a.date.localeCompare(b.date));
  const index = rows.findIndex((row) => row.high >= targetPrice || row.close >= targetPrice);
  return index >= 0 ? index + 1 : null;
}

function earliestDate(watchlists, symbol) {
  const dates = watchlists.flatMap((watchlist) => watchlist.recommendations.filter((row) => row.symbol === symbol).map((row) => row.date)).sort();
  return dates[0] || "2020-01-01";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseBoolean(value) {
  return ["true", "1", "yes", "y", "已達標"].includes(String(value || "").trim().toLowerCase());
}

function optionalNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function normalizeSymbol(value) {
  return String(value || "").match(/\d{4,6}/)?.[0] || "";
}

function pct(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function avg(values) {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

async function writeJson(fileName, value) {
  await fs.writeFile(path.join(outputDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function raw(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.raw === "number") return value.raw;
  return null;
}

function ticker(symbol, yahooSymbol, market, marketName, name) {
  return { symbol, yahooSymbol, market, marketName, name };
}

function slug(value) {
  return encodeURIComponent(value).replaceAll("%", "").toLowerCase() || "watchlist";
}
