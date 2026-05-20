import type { RecommendationAnalytics, StockAnalysisRow } from "../types/stock";

export function calculateRecommendationAnalytics(rows: StockAnalysisRow[]): Record<string, RecommendationAnalytics> {
  const byAnalyst = new Map<string, StockAnalysisRow[]>();
  rows.forEach((row) => {
    const key = row.stock.analyst || "未指定";
    byAnalyst.set(key, [...(byAnalyst.get(key) || []), row]);
  });

  return Object.fromEntries(
    [...byAnalyst.entries()].map(([analyst, analystRows]) => {
      const returns = analystRows.map((row) => row.metrics.recommendationReturn);
      const hits = analystRows.filter((row) => row.stock.currentPrice >= row.stock.targetPrice).length;
      const alpha = analystRows.map((row) => row.metrics.recommendationReturn - row.metrics.momentumScore * 0.1);
      return [
        analyst,
        {
          analyst,
          successRate: ratio(hits, analystRows.length) * 100,
          avgReturn: average(returns),
          avgDaysToTarget: average(analystRows.map((row) => row.metrics.daysToTarget).filter((value) => value > 0)),
          hitRate: ratio(hits, analystRows.length) * 100,
          recommendationAlpha: average(alpha),
          sampleSize: analystRows.length
        }
      ];
    })
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
