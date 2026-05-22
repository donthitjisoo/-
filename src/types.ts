export interface StockRow {
  id: string;
  watchlistId: string;
  watchlistName: string;
  date: string;
  symbol: string;
  name: string;
  market: "TWSE" | "TPEX" | "UNKNOWN";
  marketName: string;
  yahooSymbol: string;
  recommender: string;
  targetPrice: number;
  recommendedPrice: number;
  currentPrice: number;
  eps: number | null;
  pe: number | null;
  forwardPe: number | null;
  recommendationGapPct: number;
  distanceToTargetPct: number;
  potentialReturnPct: number;
  instantReturnPct: number;
  recommendationUpsidePct: number;
  elapsedTradingDays: number;
  targetReached: boolean;
  reachedDays: number | null;
  sourceTargetReached: boolean;
  sourceReachedDays: number | null;
  updatedAt: string;
}

export interface WatchlistData {
  id: string;
  name: string;
  source: string;
  stocks: StockRow[];
}

export interface StocksPayload {
  generatedAt: string;
  watchlists: WatchlistData[];
  stocks: StockRow[];
}

export interface AnalyticsSummary {
  count: number;
  targetReachedCount: number;
  targetRate: number;
  avgReachedDays: number;
  avgPotentialReturn: number;
  avgInstantReturn: number;
  winRate: number;
  unreachedCount: number;
}

export interface AnalyticsPayload {
  generatedAt: string;
  overall: AnalyticsSummary;
  byWatchlist: Record<string, AnalyticsSummary>;
}

export interface LeaderboardPayload {
  generatedAt: string;
  recommenders: Array<{
    recommender: string;
    count: number;
    targetReachedCount: number;
    hitRate: number;
    avgInstantReturn: number;
    avgPotentialReturn: number;
    avgReachedDays: number;
  }>;
}

export interface RecommendationCsvRecord {
  date: string;
  symbol: string;
  targetPrice: number;
  recommender: string;
  targetReached: boolean;
  reachedDays: number | null;
}
