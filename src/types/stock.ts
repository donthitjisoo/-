export interface Stock {
  symbol: string;
  name: string;
  currentPrice: number;
  targetPrice: number;
  recommendationPrice: number;
  recommendationDate: string;
  analyst: string;
  targetReached: boolean;
  reachedDays?: number;
  epsEstimate: number;
  pe: number;
  forwardPe: number;
  marketCap?: number;
  sector?: string;
}

export interface StockQuote {
  symbol: string;
  name: string;
  currentPrice: number;
  previousClose?: number;
  changePercent?: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  tradeDate?: string;
  source: string;
}

export interface FundamentalData {
  symbol: string;
  epsEstimate: number;
  pe: number;
  forwardPe: number;
  marketCap?: number;
  sector?: string;
  updatedAt?: string;
  source?: string;
}

export interface HistoricalPrice {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface RecommendationInput {
  id?: string;
  symbol: string;
  targetPrice: number;
  recommendationPrice: number;
  recommendationDate: string;
  analyst: string;
  rating: string;
  note?: string;
  targetReached?: boolean;
  reachedDays?: number;
}

export interface RecommendationCsvRecord {
  date: string;
  symbol: string;
  targetPrice: number;
  recommender: string;
  targetReached: boolean;
  reachedDays?: number;
}

export interface StockSheet {
  id: string;
  name: string;
  recommendations: RecommendationInput[];
}

export interface StockMetrics {
  distanceToTarget: number;
  potentialReturn: number;
  recommendationReturn: number;
  recommendationUpside: number;
  daysToTarget: number;
  daysToTargetSimple: number;
  daysToTargetVolatilityAdjusted: number;
  elapsedTradingDays: number;
  targetReached: boolean;
  reachedDays?: number;
  pe: number;
  forwardPe: number;
  epsEstimate: number;
  riskReward: number;
  momentumScore: number;
}

export interface StockAnalysisRow {
  stock: Stock;
  recommendation: RecommendationInput;
  metrics: StockMetrics;
  history: HistoricalPrice[];
}

export interface MarketDataSnapshot {
  updatedAt: string;
  source: string;
  quotes: StockQuote[];
}

export interface StaticDataBundle {
  market: MarketDataSnapshot;
  fundamentals: Record<string, FundamentalData>;
  history: Record<string, HistoricalPrice[]>;
}
