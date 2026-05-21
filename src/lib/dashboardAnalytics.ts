import type { StockAnalysisRow } from "../types/stock";

export interface DashboardAnalytics {
  targetRate: number;
  averageReachedDays: number;
  averagePotentialReturn: number;
  averageInstantReturn: number;
  winRate: number;
  pendingCount: number;
}

export function calculateDashboardAnalytics(rows: StockAnalysisRow[]): DashboardAnalytics {
  const reached = rows.filter((row) => row.metrics.targetReached);
  const winners = rows.filter((row) => row.metrics.recommendationReturn > 0);
  return {
    targetRate: ratio(reached.length, rows.length) * 100,
    averageReachedDays: average(reached.map((row) => row.metrics.reachedDays || row.metrics.daysToTarget).filter((value) => value > 0)),
    averagePotentialReturn: average(rows.map((row) => row.metrics.potentialReturn)),
    averageInstantReturn: average(rows.map((row) => row.metrics.recommendationReturn)),
    winRate: ratio(winners.length, rows.length) * 100,
    pendingCount: rows.length - reached.length
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
