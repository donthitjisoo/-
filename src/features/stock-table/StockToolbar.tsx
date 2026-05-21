import { Download, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import type { StockAnalysisRow, StockSheet } from "../../types/stock";
import { rowsToRecommendationCsv } from "../../lib/recommendationCsv";

interface StockToolbarProps {
  sheets: StockSheet[];
  activeSheet: StockSheet;
  rows: StockAnalysisRow[];
  onAddSheet: (name: string) => void;
  onSelectSheet: (id: string) => void;
  onImportCsv: (file: File) => Promise<number>;
}

export function StockToolbar({ sheets, activeSheet, rows, onAddSheet, onSelectSheet, onImportCsv }: StockToolbarProps) {
  const [sheetName, setSheetName] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submitSheet(event: FormEvent) {
    event.preventDefault();
    const name = sheetName.trim();
    if (!name) return;
    onAddSheet(name);
    setSheetName("");
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const count = await onImportCsv(file);
      setMessage(`已匯入 ${count} 筆推薦到「${activeSheet.name}」。`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      event.target.value = "";
    }
  }

  function exportCsv() {
    const blob = new Blob([rowsToRecommendationCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSheet.name}-recommendations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="toolbar" aria-label="股票分析工具列">
      <div className="list-bar">
        <div className="list-tabs" role="tablist" aria-label="選股清單">
          {sheets.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              className={sheet.id === activeSheet.id ? "active" : ""}
              onClick={() => onSelectSheet(sheet.id)}
            >
              {sheet.name} {sheet.recommendations.length}
            </button>
          ))}
        </div>
        <form className="list-form" onSubmit={submitSheet}>
          <input value={sheetName} onChange={(event) => setSheetName(event.target.value)} placeholder="新增 watchlist" />
          <button type="submit">新增</button>
        </form>
      </div>

      <div className="csv-actions">
        <input ref={fileInputRef} className="hidden-file" type="file" accept=".csv,text/csv" onChange={importCsv} />
        <button type="button" className="primary-button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
          匯入 CSV
        </button>
        <button type="button" onClick={exportCsv}>
          <Download size={16} />
          匯出 CSV
        </button>
        <span>{message || "CSV 欄位固定：date, symbol, target_price, recommender, target_reached, reached_days"}</span>
      </div>
    </section>
  );
}
