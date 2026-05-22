import { Download, Moon, RefreshCw, Search, Sun, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseRecommendationCsv, rowsToRecommendationCsv, uploadedRecordsToRows } from "./lib/csv";
import { currency, number, percent } from "./lib/format";
import type { AnalyticsPayload, AnalyticsSummary, LeaderboardPayload, StockRow, StocksPayload, WatchlistData } from "./types";

type SortKey = "potentialReturnPct" | "instantReturnPct" | "distanceToTargetPct" | "reachedDays";

interface LocalWatchlist {
  id: string;
  name: string;
  stocks: StockRow[];
}

export function App() {
  const [stocksPayload, setStocksPayload] = useState<StocksPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null);
  const [activeWatchlistId, setActiveWatchlistId] = useState("default");
  const [localWatchlists, setLocalWatchlists] = useState<LocalWatchlist[]>(() => loadLocalWatchlists());
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("all");
  const [recommender, setRecommender] = useState("all");
  const [targetState, setTargetState] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("potentialReturnPct");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [status, setStatus] = useState("載入資料中...");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    loadData().catch((error) => setStatus(error instanceof Error ? error.message : "資料載入失敗"));
  }, []);

  useEffect(() => {
    localStorage.setItem("local-watchlists", JSON.stringify(localWatchlists));
  }, [localWatchlists]);

  async function loadData() {
    setStatus("載入靜態 JSON...");
    const [stocksResult, analyticsResult, leaderboardResult] = await Promise.all([
      fetchJson<StocksPayload>("/data/stocks.json"),
      fetchJson<AnalyticsPayload>("/data/analytics.json"),
      fetchJson<LeaderboardPayload>("/data/leaderboard.json")
    ]);
    setStocksPayload(stocksResult);
    setAnalytics(analyticsResult);
    setLeaderboard(leaderboardResult);
    setStatus(`資料更新時間：${new Date(stocksResult.generatedAt).toLocaleString("zh-TW")}`);
  }

  const allWatchlists = useMemo(() => {
    const remote = stocksPayload?.watchlists ?? [];
    return [...remote, ...localWatchlists] as Array<WatchlistData | LocalWatchlist>;
  }, [stocksPayload, localWatchlists]);

  const activeWatchlist = allWatchlists.find((watchlist) => watchlist.id === activeWatchlistId) || allWatchlists[0];
  const activeRows = activeWatchlist?.stocks ?? [];
  const activeAnalytics = activeWatchlist && analytics?.byWatchlist[activeWatchlist.id]
    ? analytics.byWatchlist[activeWatchlist.id]
    : summarizeRows(activeRows);

  const recommenders = useMemo(() => [...new Set(activeRows.map((row) => row.recommender).filter(Boolean))], [activeRows]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return activeRows
      .filter((row) => !normalizedQuery || row.symbol.includes(normalizedQuery) || row.name.toLowerCase().includes(normalizedQuery))
      .filter((row) => market === "all" || row.market === market)
      .filter((row) => recommender === "all" || row.recommender === recommender)
      .filter((row) => targetState === "all" || String(row.targetReached) === targetState)
      .slice()
      .sort((a: StockRow, b: StockRow) => {
        const aValue = a[sortKey] ?? -Infinity;
        const bValue = b[sortKey] ?? -Infinity;
        return Number(bValue) - Number(aValue);
      });
  }, [activeRows, market, query, recommender, sortKey, targetState]);

  async function uploadCsv(file: File) {
    const records = parseRecommendationCsv(await file.text());
    const id = `upload-${Date.now().toString(36)}`;
    const name = file.name.replace(/\.csv$/i, "");
    const stocks = uploadedRecordsToRows(records, stocksPayload?.stocks ?? [], id, name);
    setLocalWatchlists((current) => [...current, { id, name, stocks }]);
    setActiveWatchlistId(id);
    setStatus(`已匯入本地 CSV：${name}，共 ${stocks.length} 筆。推上 GitHub 後 Actions 才會正式更新 JSON。`);
  }

  function exportCsv() {
    const csv = rowsToRecommendationCsv(visibleRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeWatchlist?.name || "watchlist"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Cloudflare Pages 靜態部署</p>
          <h1>飆股推薦追蹤 Dashboard</h1>
          <p className="subtitle">CSV 是唯一推薦來源，GitHub Actions 每日預先產生 JSON，前端只負責快速呈現。</p>
        </div>
        <div className="hero-actions">
          <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="切換深色淺色">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="button secondary" onClick={loadData}>
            <RefreshCw size={16} />
            重新載入
          </button>
        </div>
      </header>

      <section className="metrics">
        <Metric title="達標率" value={percent(activeAnalytics?.targetRate ?? analytics?.overall.targetRate)} />
        <Metric title="平均達標天數" value={`${number(activeAnalytics?.avgReachedDays ?? analytics?.overall.avgReachedDays, 1)} 天`} />
        <Metric title="平均潛在報酬" value={percent(activeAnalytics?.avgPotentialReturn ?? analytics?.overall.avgPotentialReturn)} />
        <Metric title="平均即時報酬" value={percent(activeAnalytics?.avgInstantReturn ?? analytics?.overall.avgInstantReturn)} />
        <Metric title="勝率" value={percent(activeAnalytics?.winRate ?? analytics?.overall.winRate)} />
        <Metric title="尚未達標" value={String(activeAnalytics?.unreachedCount ?? analytics?.overall.unreachedCount ?? 0)} />
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            {allWatchlists.map((watchlist) => (
              <button
                key={watchlist.id}
                className={`tab ${watchlist.id === activeWatchlist?.id ? "active" : ""}`}
                onClick={() => setActiveWatchlistId(watchlist.id)}
              >
                {watchlist.name}
                <span>{watchlist.stocks.length}</span>
              </button>
            ))}
          </div>
          <div className="csv-actions">
            <input
              ref={fileRef}
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadCsv(file).catch((error) => setStatus(error instanceof Error ? error.message : "CSV 匯入失敗"));
                event.currentTarget.value = "";
              }}
            />
            <button className="button secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              CSV Upload
            </button>
            <button className="button secondary" onClick={exportCsv}>
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="filters">
          <label className="search">
            <Search size={16} />
            <input placeholder="搜尋股票代號或名稱" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={market} onChange={(event) => setMarket(event.target.value)}>
            <option value="all">全部市場</option>
            <option value="TWSE">上市</option>
            <option value="TPEX">上櫃</option>
            <option value="UNKNOWN">未知</option>
          </select>
          <select value={recommender} onChange={(event) => setRecommender(event.target.value)}>
            <option value="all">全部推薦人</option>
            {recommenders.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={targetState} onChange={(event) => setTargetState(event.target.value)}>
            <option value="all">全部達標狀態</option>
            <option value="true">已達標</option>
            <option value="false">未達標</option>
          </select>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            <option value="potentialReturnPct">依潛在報酬排序</option>
            <option value="instantReturnPct">依即時報酬排序</option>
            <option value="distanceToTargetPct">依距離目標排序</option>
            <option value="reachedDays">依達標天數排序</option>
          </select>
        </div>

        <div className="status">{status}</div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>代號</th>
                <th>名稱</th>
                <th>市場</th>
                <th>推薦日期</th>
                <th>推薦人</th>
                <th>現價</th>
                <th>目標價</th>
                <th>推薦時價</th>
                <th>推薦時差 %</th>
                <th>距離目標 %</th>
                <th>潛在報酬 %</th>
                <th>即時報酬 %</th>
                <th>達標</th>
                <th>達標天數</th>
                <th>EPS</th>
                <th>PE</th>
                <th>Forward PE</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row: StockRow) => (
                <tr key={`${row.watchlistId}-${row.id}`}>
                  <td className="strong">{row.symbol}</td>
                  <td>{row.name}</td>
                  <td><span className="badge">{row.marketName}</span></td>
                  <td>{row.date}</td>
                  <td>{row.recommender}</td>
                  <td>{currency(row.currentPrice)}</td>
                  <td>{currency(row.targetPrice)}</td>
                  <td>{currency(row.recommendedPrice)}</td>
                  <td className={tone(row.recommendationGapPct)}>{percent(row.recommendationGapPct)}</td>
                  <td className={tone(row.distanceToTargetPct)}>{percent(row.distanceToTargetPct)}</td>
                  <td className={tone(row.potentialReturnPct)}>{percent(row.potentialReturnPct)}</td>
                  <td className={tone(row.instantReturnPct)}>{percent(row.instantReturnPct)}</td>
                  <td><span className={`pill ${row.targetReached ? "ok" : "wait"}`}>{row.targetReached ? "已達標" : "未達標"}</span></td>
                  <td>{row.reachedDays ?? "-"}</td>
                  <td>{number(row.eps)}</td>
                  <td>{number(row.pe)}</td>
                  <td>{number(row.forwardPe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel leaderboard">
        <div>
          <h2>推薦人排行榜</h2>
          <p>由 GitHub Actions 預先產生 `leaderboard.json`，前端只 render。</p>
        </div>
        <div className="leader-grid">
          {(leaderboard?.recommenders ?? []).slice(0, 6).map((item) => (
            <div className="leader-card" key={item.recommender}>
              <strong>{item.recommender}</strong>
              <span>命中率 {percent(item.hitRate)}</span>
              <span>平均即時 {percent(item.avgInstantReturn)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(`${url}?v=${Date.now()}`);
  if (!response.ok) throw new Error(`${url} 載入失敗`);
  return response.json();
}

function summarizeRows(rows: StockRow[]): AnalyticsSummary {
  const reached = rows.filter((row) => row.targetReached);
  return {
    count: rows.length,
    targetReachedCount: reached.length,
    targetRate: pct(reached.length, rows.length),
    avgReachedDays: avg(reached.map((row) => row.reachedDays).filter((value) => value !== null) as number[]),
    avgPotentialReturn: avg(rows.map((row) => row.potentialReturnPct)),
    avgInstantReturn: avg(rows.map((row) => row.instantReturnPct)),
    winRate: pct(rows.filter((row) => row.instantReturnPct > 0).length, rows.length),
    unreachedCount: rows.length - reached.length
  };
}

function loadLocalWatchlists(): LocalWatchlist[] {
  try {
    return JSON.parse(localStorage.getItem("local-watchlists") || "[]");
  } catch {
    return [];
  }
}

function pct(numerator: number, denominator: number) {
  return denominator ? (numerator / denominator) * 100 : 0;
}

function avg(values: number[]) {
  const numbers = values.filter((value) => Number.isFinite(value));
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function tone(value: number | null | undefined) {
  if (!value) return "";
  return value > 0 ? "positive" : "negative";
}
