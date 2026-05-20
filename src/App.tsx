import { useMemo } from "react";
import { AppHeader } from "./components/AppHeader";
import { StockAnalysisTable } from "./features/stock-table/StockAnalysisTable";
import { StockToolbar } from "./features/stock-table/StockToolbar";
import { useLocalStockSheets } from "./hooks/useLocalStockSheets";
import { useQuoteIndex, useStockData } from "./hooks/useStockData";
import { useStockAnalysis } from "./hooks/useStockAnalysis";
import { calculateRecommendationAnalytics } from "./lib/recommendationAnalytics";

export function App() {
  const { data, isLoading, error, reload } = useStockData();
  const quoteIndex = useQuoteIndex(data);
  const { sheets, activeSheet, addSheet, setActiveSheetId, upsertRecommendation, removeRecommendation } = useLocalStockSheets();
  const rows = useStockAnalysis(activeSheet, data);
  const liveAnalytics = useMemo(() => calculateRecommendationAnalytics(rows), [rows]);
  const enrichedRows = useMemo(
    () => rows.map((row) => ({ ...row, analytics: liveAnalytics[row.stock.analyst] || row.analytics })),
    [liveAnalytics, rows]
  );

  return (
    <>
      <AppHeader updatedAt={data?.market.updatedAt} source={data?.market.source} onReload={reload} />
      <main>
        <StockToolbar
          sheets={sheets}
          activeSheet={activeSheet}
          quotes={[...quoteIndex.values()]}
          onAddSheet={addSheet}
          onSelectSheet={setActiveSheetId}
          onUpsertRecommendation={upsertRecommendation}
        />

        <section className="stats" aria-label="平台摘要">
          <div>
            <span className="stat-label">分析檔數</span>
            <strong>{enrichedRows.length}</strong>
          </div>
          <div>
            <span className="stat-label">靜態資料庫</span>
            <strong>{data?.market.quotes.length || 0}</strong>
          </div>
          <div>
            <span className="stat-label">狀態</span>
            <strong>{isLoading ? "載入中" : error || "ready"}</strong>
          </div>
        </section>

        <StockAnalysisTable rows={enrichedRows} onRemove={removeRecommendation} />
      </main>
    </>
  );
}
