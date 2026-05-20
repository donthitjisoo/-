import { RefreshCw } from "lucide-react";
import { formatDateTime } from "../utils/formatters";

interface AppHeaderProps {
  updatedAt?: string;
  source?: string;
  onReload: () => void;
}

export function AppHeader({ updatedAt, source, onReload }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">GitHub Pages financial analytics</p>
        <h1>飆股分析平台</h1>
      </div>
      <div className="header-actions">
        <div className="market-state">
          <span className="dot" />
          <span>{source || "靜態資料"}</span>
          <strong>{formatDateTime(updatedAt)}</strong>
        </div>
        <button type="button" className="icon-button" onClick={onReload} aria-label="重新載入資料" title="重新載入資料">
          <RefreshCw size={17} />
        </button>
      </div>
    </header>
  );
}
