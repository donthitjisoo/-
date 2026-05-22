import type { RecommendationCsvRecord, StockRow } from "../types";

export const CSV_HEADERS = ["date", "symbol", "target_price", "recommender", "target_reached", "reached_days"] as const;

export function parseRecommendationCsv(text: string): RecommendationCsvRecord[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((cell) => cell.trim().toLowerCase());
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const missing = CSV_HEADERS.filter((header) => indexes[header] === undefined);
  if (missing.length) throw new Error(`CSV 缺少欄位：${missing.join(", ")}`);

  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row, index) => {
    const symbol = row[indexes.symbol]?.match(/\d{4,6}/)?.[0] || "";
    const targetPrice = Number(row[indexes.target_price]);
    if (!symbol) throw new Error(`第 ${index + 2} 列股票代號格式錯誤`);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw new Error(`第 ${index + 2} 列目標價格式錯誤`);
    return {
      date: row[indexes.date]?.trim() || "",
      symbol,
      targetPrice,
      recommender: row[indexes.recommender]?.trim() || "",
      targetReached: parseBoolean(row[indexes.target_reached]),
      reachedDays: optionalNumber(row[indexes.reached_days])
    };
  });
}

export function rowsToRecommendationCsv(rows: StockRow[]) {
  const body = rows.map((row) =>
    [
      row.date,
      row.symbol,
      row.targetPrice,
      row.recommender,
      row.targetReached ? "true" : "false",
      row.reachedDays ?? ""
    ].map(csvCell).join(",")
  );
  return [[...CSV_HEADERS].join(","), ...body].join("\n");
}

export function uploadedRecordsToRows(records: RecommendationCsvRecord[], knownRows: StockRow[], watchlistId: string, watchlistName: string): StockRow[] {
  const latestBySymbol = new Map<string, StockRow>();
  for (const row of knownRows) latestBySymbol.set(row.symbol, row);

  return records.map((record, index) => {
    const known = latestBySymbol.get(record.symbol);
    const currentPrice = known?.currentPrice ?? 0;
    const recommendedPrice = known?.recommendedPrice ?? currentPrice;
    const targetReached = record.targetReached || (currentPrice > 0 && currentPrice >= record.targetPrice);
    return {
      id: `upload-${watchlistId}-${record.symbol}-${index}`,
      watchlistId,
      watchlistName,
      date: record.date,
      symbol: record.symbol,
      name: known?.name ?? record.symbol,
      market: known?.market ?? "UNKNOWN",
      marketName: known?.marketName ?? "未知",
      yahooSymbol: known?.yahooSymbol ?? `${record.symbol}.TW`,
      recommender: record.recommender,
      targetPrice: record.targetPrice,
      recommendedPrice,
      currentPrice,
      eps: known?.eps ?? null,
      pe: known?.pe ?? null,
      forwardPe: known?.forwardPe ?? null,
      recommendationGapPct: pct(currentPrice - recommendedPrice, recommendedPrice),
      distanceToTargetPct: pct(record.targetPrice - currentPrice, currentPrice),
      potentialReturnPct: pct(record.targetPrice - currentPrice, currentPrice),
      instantReturnPct: pct(currentPrice - recommendedPrice, recommendedPrice),
      recommendationUpsidePct: pct(record.targetPrice - recommendedPrice, recommendedPrice),
      elapsedTradingDays: known?.elapsedTradingDays ?? 0,
      targetReached,
      reachedDays: record.targetReached ? record.reachedDays : targetReached ? known?.elapsedTradingDays ?? null : null,
      sourceTargetReached: record.targetReached,
      sourceReachedDays: record.reachedDays,
      updatedAt: known?.updatedAt ?? new Date().toISOString()
    };
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseBoolean(value: string) {
  return ["true", "1", "yes", "y", "已達標"].includes(String(value || "").trim().toLowerCase());
}

function optionalNumber(value: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function pct(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return (numerator / denominator) * 100;
}
