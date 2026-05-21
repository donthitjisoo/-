import { useMemo, useState } from "react";
import { useVirtualRows } from "../../hooks/useVirtualRows";
import type { StockAnalysisRow } from "../../types/stock";
import { classForSignedValue, formatDate, formatNumber, formatPercent } from "../../utils/formatters";

interface StockAnalysisTableProps {
  rows: StockAnalysisRow[];
}

const ROW_HEIGHT = 54;
const VIEWPORT_HEIGHT = 560;

type SortKey = "symbol" | "currentPrice" | "targetPrice" | "potentialReturn" | "recommendationReturn" | "daysToTarget" | "pe";

export function StockAnalysisTable({ rows }: StockAnalysisTableProps) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const filteredRows = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    const nextRows = keyword
      ? rows.filter(({ stock, recommendation }) =>
      `${stock.symbol} ${stock.name} ${stock.analyst} ${recommendation.rating}`.toLowerCase().includes(keyword)
    )
      : rows;
    return [...nextRows].sort((a, b) => compareRows(a, b, sortKey, sortDirection));
  }, [filter, rows, sortDirection, sortKey]);
  const virtual = useVirtualRows(filteredRows, ROW_HEIGHT, VIEWPORT_HEIGHT);

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(nextKey);
      setSortDirection("asc");
    }
  }

  return (
    <section className="sheet-section">
      <div className="sheet-head">
        <div>
          <h2>Financial Metrics Engine</h2>
          <p>{filteredRows.length} 檔，所有欄位由 calculateStockMetrics() 產生。</p>
        </div>
        <label className="search">
          搜尋
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="代號、名稱、推薦人" />
        </label>
      </div>

      <div className="table-viewport" style={{ height: VIEWPORT_HEIGHT }} onScroll={(event) => virtual.setScrollTop(event.currentTarget.scrollTop)}>
        <table>
          <thead>
            <tr>
              <th><button type="button" className="th-button" onClick={() => changeSort("symbol")}>代號</button></th>
              <th>名稱</th>
              <th><button type="button" className="th-button" onClick={() => changeSort("currentPrice")}>現價</button></th>
              <th><button type="button" className="th-button" onClick={() => changeSort("targetPrice")}>目標價</button></th>
              <th>距離目標</th>
              <th><button type="button" className="th-button" onClick={() => changeSort("potentialReturn")}>潛在報酬</button></th>
              <th><button type="button" className="th-button" onClick={() => changeSort("recommendationReturn")}>即時報酬</button></th>
              <th>推薦時差</th>
              <th>推薦日期</th>
              <th>已過交易日</th>
              <th><button type="button" className="th-button" onClick={() => changeSort("daysToTarget")}>達標天數</button></th>
              <th><button type="button" className="th-button" onClick={() => changeSort("pe")}>PE</button></th>
              <th>Forward PE</th>
              <th>EPS_估</th>
              <th>推薦人</th>
              <th>達標</th>
            </tr>
          </thead>
          <tbody style={{ height: virtual.totalHeight }}>
            <tr style={{ height: virtual.offsetTop }} aria-hidden="true" />
            {virtual.rows.map((row) => (
              <tr key={row.stock.symbol} style={{ height: ROW_HEIGHT }}>
                <td className="code-cell">{row.stock.symbol}</td>
                <td>{row.stock.name}</td>
                <td className="numeric">{formatNumber(row.stock.currentPrice)}</td>
                <td className="numeric">{formatNumber(row.stock.targetPrice)}</td>
                <td className={classForSignedValue(row.metrics.distanceToTarget)}>{formatPercent(row.metrics.distanceToTarget)}</td>
                <td className={classForSignedValue(row.metrics.potentialReturn)}>{formatPercent(row.metrics.potentialReturn)}</td>
                <td className={classForSignedValue(row.metrics.recommendationReturn)}>{formatPercent(row.metrics.recommendationReturn)}</td>
                <td className={classForSignedValue(row.metrics.recommendationUpside)}>{formatPercent(row.metrics.recommendationUpside)}</td>
                <td>{formatDate(row.stock.recommendationDate)}</td>
                <td className="numeric">{row.metrics.elapsedTradingDays}</td>
                <td className="numeric">{row.metrics.daysToTarget}</td>
                <td className="numeric">{formatNumber(row.metrics.pe)}</td>
                <td className="numeric">{formatNumber(row.metrics.forwardPe)}</td>
                <td className="numeric">{formatNumber(row.metrics.epsEstimate)}</td>
                <td>{row.stock.analyst}</td>
                <td>{row.metrics.targetReached ? "已達標" : "未達標"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function compareRows(a: StockAnalysisRow, b: StockAnalysisRow, key: SortKey, direction: "asc" | "desc"): number {
  const multiplier = direction === "asc" ? 1 : -1;
  const valueA = valueForSort(a, key);
  const valueB = valueForSort(b, key);
  if (valueA > valueB) return multiplier;
  if (valueA < valueB) return -multiplier;
  return a.stock.symbol.localeCompare(b.stock.symbol) * multiplier;
}

function valueForSort(row: StockAnalysisRow, key: SortKey): string | number {
  if (key === "symbol") return row.stock.symbol;
  if (key === "currentPrice") return row.stock.currentPrice;
  if (key === "targetPrice") return row.stock.targetPrice;
  if (key === "potentialReturn") return row.metrics.potentialReturn;
  if (key === "recommendationReturn") return row.metrics.recommendationReturn;
  if (key === "daysToTarget") return row.metrics.daysToTarget;
  if (key === "pe") return row.metrics.pe;
  return row.stock.symbol;
}
