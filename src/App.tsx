import { AppHeader } from "./components/AppHeader";
import { StockAnalysisTable } from "./features/stock-table/StockAnalysisTable";
import { StockToolbar } from "./features/stock-table/StockToolbar";
import { useStockData } from "./hooks/useStockData";
import { useStockAnalysis } from "./hooks/useStockAnalysis";
import { useRecommendationSheets } from "./hooks/useRecommendationSheets";
import { calculateDashboardAnalytics } from "./lib/dashboardAnalytics";
import { formatNumber, formatPercent } from "./utils/formatters";

export function App() {
  const { data, isLoading, error, reload } = useStockData();
  const { sheets, activeSheet, addSheet, setActiveSheetId, importCsvToActiveSheet } = useRecommendationSheets();
  const rows = useStockAnalysis(activeSheet, data);
  const dashboard = calculateDashboardAnalytics(rows);

  return (
    <>
      <AppHeader updatedAt={data?.market.updatedAt} source={data?.market.source} onReload={reload} />
      <main>
        <StockToolbar
          sheets={sheets}
          activeSheet={activeSheet}
          rows={rows}
          onAddSheet={addSheet}
          onSelectSheet={setActiveSheetId}
          onImportCsv={importCsvToActiveSheet}
        />

        <section className="stats" aria-label="平台摘要">
          <div>
            <span className="stat-label">分析檔數</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span className="stat-label">靜態資料庫</span>
            <strong>{data?.market.quotes.length || 0}</strong>
          </div>
          <div>
            <span className="stat-label">狀態</span>
            <strong>{isLoading ? "載入中" : error || `CSV · ${activeSheet.name}`}</strong>
          </div>
        </section>

        <section className="stats dashboard" aria-label="績效摘要">
          <div>
            <span className="stat-label">達標率</span>
            <strong>{formatPercent(dashboard.targetRate)}</strong>
          </div>
          <div>
            <span className="stat-label">平均達標天數</span>
            <strong>{formatNumber(dashboard.averageReachedDays, 0)}</strong>
          </div>
          <div>
            <span className="stat-label">平均潛在報酬</span>
            <strong>{formatPercent(dashboard.averagePotentialReturn)}</strong>
          </div>
          <div>
            <span className="stat-label">平均即時報酬</span>
            <strong>{formatPercent(dashboard.averageInstantReturn)}</strong>
          </div>
          <div>
            <span className="stat-label">勝率</span>
            <strong>{formatPercent(dashboard.winRate)}</strong>
          </div>
          <div>
            <span className="stat-label">尚未達標</span>
            <strong>{dashboard.pendingCount}</strong>
          </div>
        </section>

        <StockAnalysisTable rows={rows} />
      </main>
    </>
  );
}
