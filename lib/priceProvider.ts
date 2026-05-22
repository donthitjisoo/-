import "server-only";

import { resolveTaiwanTicker } from "./twStockResolver";
import type { PriceHistoryRecord, Quote } from "./types";

const quoteCache = new Map<string, { expiresAt: number; value: Quote }>();
const historyCache = new Map<string, { expiresAt: number; value: PriceHistoryRecord[] }>();
const QUOTE_TTL_MS = 60 * 1000;
const HISTORY_TTL_MS = 30 * 60 * 1000;

export async function getQuote(symbol: string): Promise<Quote> {
  const resolved = await resolveTaiwanTicker(symbol);
  const cached = quoteCache.get(resolved.symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const yahooQuote = await fetchYahooQuote(resolved.yahooSymbol);
    const currentPrice = yahooQuote.currentPrice;
    const previousClose = yahooQuote.previousClose;
    const value: Quote = {
      symbol: resolved.symbol,
      yahooSymbol: resolved.yahooSymbol,
      name: resolved.name || resolved.symbol,
      market: resolved.market,
      marketName: resolved.marketName,
      currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0,
      updatedAt: new Date().toISOString()
    };
    quoteCache.set(resolved.symbol, { expiresAt: Date.now() + QUOTE_TTL_MS, value });
    return value;
  } catch {
    const value: Quote = {
      symbol: resolved.symbol,
      yahooSymbol: resolved.yahooSymbol,
      name: resolved.name || resolved.symbol,
      market: resolved.market,
      marketName: resolved.marketName,
      currentPrice: 0,
      updatedAt: new Date().toISOString()
    };
    quoteCache.set(resolved.symbol, { expiresAt: Date.now() + 10_000, value });
    return value;
  }
}

async function fetchYahooQuote(yahooSymbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`;
  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error("Yahoo Finance quote failed");
  const payload = await response.json() as YahooChartResponse;
  const meta = payload.chart?.result?.[0]?.meta;
  return {
    currentPrice: Number(meta?.regularMarketPrice || meta?.previousClose || 0),
    previousClose: Number(meta?.previousClose || 0)
  };
}

export async function getQuotes(symbols: string[]) {
  const unique = [...new Set(symbols.filter(Boolean))];
  const quotes = await Promise.all(unique.map(getQuote));
  return Object.fromEntries(quotes.map((quote) => [quote.symbol, quote]));
}

export async function getHistoricalPrices(symbol: string, fromDate: string): Promise<PriceHistoryRecord[]> {
  const resolved = await resolveTaiwanTicker(symbol);
  const key = `${resolved.symbol}:${fromDate}`;
  const cached = historyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const value = await fetchYahooChart(resolved.symbol, resolved.yahooSymbol, fromDate);
    historyCache.set(key, { expiresAt: Date.now() + HISTORY_TTL_MS, value });
    return value;
  } catch {
    return [];
  }
}

async function fetchYahooChart(symbol: string, yahooSymbol: string, fromDate: string): Promise<PriceHistoryRecord[]> {
  const period1 = Math.floor(new Date(`${fromDate}T00:00:00+08:00`).getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${period1}&period2=${period2}&interval=1d`;
  const response = await fetch(url, { next: { revalidate: 1800 } });
  if (!response.ok) return [];
  const payload = await response.json() as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];
  return timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    symbol,
    open: Number(quote.open?.[index] || 0),
    high: Number(quote.high?.[index] || 0),
    low: Number(quote.low?.[index] || 0),
    close: Number(quote.close?.[index] || 0),
    volume: Number(quote.volume?.[index] || 0)
  }));
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}
