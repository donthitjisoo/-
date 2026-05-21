import { useMemo } from "react";
import { calculateStockMetrics } from "../lib/metricsEngine";
import { findHistoricalCloseOnOrBeforeDate } from "../lib/calculations";
import type { RecommendationInput, StaticDataBundle, Stock, StockAnalysisRow, StockSheet } from "../types/stock";

export function useStockAnalysis(sheet: StockSheet, data: StaticDataBundle | null): StockAnalysisRow[] {
  return useMemo(() => {
    if (!data) return [];
    const quotes = new Map(data.market.quotes.map((quote) => [quote.symbol, quote]));
    return sheet.recommendations
      .map((recommendation) => toAnalysisRow(recommendation, data, quotes.get(recommendation.symbol)))
      .filter((row): row is StockAnalysisRow => Boolean(row));
  }, [data, sheet]);
}

function toAnalysisRow(
  recommendation: RecommendationInput,
  data: StaticDataBundle,
  quote = data.market.quotes.find((item) => item.symbol === recommendation.symbol)
): StockAnalysisRow | null {
  if (!quote) return null;
  const fundamentals = data.fundamentals[recommendation.symbol];
  const currentPrice = quote.currentPrice;
  const history = data.history[recommendation.symbol] || [];
  const recommendationPrice =
    recommendation.recommendationPrice || findHistoricalCloseOnOrBeforeDate(recommendation.recommendationDate, history) || currentPrice;
  const epsEstimate = fundamentals?.epsEstimate || 0;
  const stock: Stock = {
    symbol: recommendation.symbol,
    name: quote.name,
    currentPrice,
    targetPrice: recommendation.targetPrice || currentPrice,
    recommendationPrice,
    recommendationDate: recommendation.recommendationDate,
    analyst: recommendation.analyst || "未指定",
    targetReached: Boolean(recommendation.targetReached),
    reachedDays: recommendation.reachedDays,
    epsEstimate,
    pe: fundamentals?.pe || 0,
    forwardPe: fundamentals?.forwardPe || (epsEstimate ? currentPrice / epsEstimate : 0),
    marketCap: fundamentals?.marketCap,
    sector: fundamentals?.sector
  };
  return {
    stock,
    recommendation,
    history,
    metrics: calculateStockMetrics(stock, history)
  };
}
