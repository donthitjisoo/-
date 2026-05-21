import type {
  FundamentalData,
  HistoricalPrice,
  MarketDataSnapshot,
  StaticDataBundle,
  StockQuote
} from "../types/stock";

const DATA_BASE_URL = `${import.meta.env.BASE_URL}data`;

export async function loadStaticData(): Promise<StaticDataBundle> {
  const [market, fundamentals, history] = await Promise.all([
    fetchJson<MarketDataSnapshot>(`${DATA_BASE_URL}/stocks.json`),
    fetchJson<Record<string, FundamentalData>>(`${DATA_BASE_URL}/fundamentals.json`),
    fetchJson<Record<string, HistoricalPrice[]>>(`${DATA_BASE_URL}/history.json`)
  ]);

  return {
    market: normalizeMarketSnapshot(market),
    fundamentals,
    history
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function normalizeMarketSnapshot(snapshot: MarketDataSnapshot): MarketDataSnapshot {
  return {
    updatedAt: snapshot.updatedAt,
    source: snapshot.source,
    quotes: snapshot.quotes.map(normalizeQuote).filter((quote) => quote.symbol && quote.currentPrice > 0)
  };
}

function normalizeQuote(quote: StockQuote): StockQuote {
  return {
    symbol: String(quote.symbol || "").trim(),
    name: String(quote.name || "").trim(),
    currentPrice: Number(quote.currentPrice || 0),
    previousClose: numeric(quote.previousClose),
    changePercent: numeric(quote.changePercent),
    volume: numeric(quote.volume),
    open: numeric(quote.open),
    high: numeric(quote.high),
    low: numeric(quote.low),
    tradeDate: quote.tradeDate || "",
    source: quote.source || "unknown"
  };
}

function numeric(value: unknown): number | undefined {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}
