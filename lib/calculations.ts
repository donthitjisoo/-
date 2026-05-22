import type { HoldingRecord, HoldingView, PriceHistoryRecord, Quote, RecommendationRecord, RecommendationView } from "./types";

export function calculateRecommendationView(
  recommendation: RecommendationRecord,
  quote: Quote,
  history: PriceHistoryRecord[]
): RecommendationView {
  const targetReached = quote.currentPrice >= recommendation.target_price;
  const reachedDays = calculateReachedTradingDays(recommendation.date, recommendation.symbol, recommendation.target_price, history);

  return {
    ...recommendation,
    stockName: quote.name,
    market: quote.market,
    marketName: quote.marketName,
    yahooSymbol: quote.yahooSymbol,
    currentPrice: quote.currentPrice,
    recommendationReturnPct: safePct(quote.currentPrice - recommendation.recommended_price, recommendation.recommended_price),
    initialPotentialReturnPct: safePct(recommendation.target_price - recommendation.recommended_price, recommendation.recommended_price),
    realtimePotentialReturnPct: safePct(recommendation.target_price - quote.currentPrice, quote.currentPrice),
    targetReached,
    reachedDays: targetReached ? reachedDays : null
  };
}

export function calculateHoldingView(holding: HoldingRecord, quote: Quote): HoldingView {
  const cost = holding.shares * holding.avg_cost;
  const marketValue = holding.shares * quote.currentPrice;
  const unrealizedPnL = marketValue - cost;
  const todayPnL = holding.shares * (quote.change || 0);

  return {
    ...holding,
    stockName: quote.name,
    market: quote.market,
    marketName: quote.marketName,
    yahooSymbol: quote.yahooSymbol,
    currentPrice: quote.currentPrice,
    cost,
    marketValue,
    todayPnL,
    unrealizedPnL,
    unrealizedPnLPct: safePct(unrealizedPnL, cost)
  };
}

export function calculateReachedTradingDays(date: string, symbol: string, targetPrice: number, history: PriceHistoryRecord[]) {
  const rows = history
    .filter((row) => row.symbol === symbol && row.date >= date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const hitIndex = rows.findIndex((row) => row.high >= targetPrice);
  return hitIndex >= 0 ? hitIndex + 1 : null;
}

export function safePct(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return (numerator / denominator) * 100;
}
