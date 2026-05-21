import type { RecommendationCsvRecord, StockAnalysisRow } from "../types/stock";

export const CSV_HEADERS = ["date", "symbol", "target_price", "recommender", "target_reached", "reached_days"] as const;

export function parseRecommendationCsv(text: string): RecommendationCsvRecord[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  const missing = CSV_HEADERS.filter((name) => indexes[name] === undefined);
  if (missing.length > 0) throw new Error(`CSV 缺少欄位：${missing.join(", ")}`);

  return rows.slice(1).map((row, index) => {
    const date = requireCell(row, indexes.date, index, "date");
    const symbol = requireCell(row, indexes.symbol, index, "symbol").match(/\d{4,6}/)?.[0] || "";
    const targetPrice = Number(requireCell(row, indexes.target_price, index, "target_price"));
    const recommender = requireCell(row, indexes.recommender, index, "recommender");
    if (!symbol) throw new Error(`第 ${index + 2} 列股票代號格式錯誤`);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) throw new Error(`第 ${index + 2} 列目標價格式錯誤`);
    return {
      date,
      symbol,
      targetPrice,
      recommender,
      targetReached: parseBoolean(row[indexes.target_reached]),
      reachedDays: optionalNumber(row[indexes.reached_days])
    };
  });
}

export function rowsToRecommendationCsv(rows: StockAnalysisRow[]): string {
  const body = rows.map((row) =>
    [
      row.stock.recommendationDate,
      row.stock.symbol,
      row.stock.targetPrice,
      row.stock.analyst,
      row.metrics.targetReached ? "true" : "false",
      row.metrics.reachedDays ?? ""
    ].map(csvCell).join(",")
  );
  return [[...CSV_HEADERS].join(","), ...body].join("\n");
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
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function requireCell(row: string[], index: number, rowIndex: number, name: string): string {
  const value = row[index]?.trim();
  if (!value) throw new Error(`第 ${rowIndex + 2} 列缺少 ${name}`);
  return value;
}

function parseBoolean(value: string | undefined): boolean {
  return ["true", "1", "yes", "y", "是", "已達標"].includes(String(value || "").trim().toLowerCase());
}

function optionalNumber(value: string | undefined): number | undefined {
  const number = Number(String(value || "").trim());
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
