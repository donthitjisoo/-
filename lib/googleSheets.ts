import "server-only";

import { sheets as googleSheetsApi } from "@googleapis/sheets";
import { GoogleAuth } from "google-auth-library";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HoldingRecord, PriceHistoryRecord, RecommendationRecord, SheetConfig } from "./types";
import { createId, toNumber } from "./utils";

const SHEETS = {
  recommendations: {
    name: "recommendations",
    headers: ["id", "date", "symbol", "target_price", "recommended_price", "recommender", "note"]
  },
  holdings: {
    name: "holdings",
    headers: ["id", "symbol", "shares", "avg_cost", "broker", "account", "note"]
  },
  price_history: {
    name: "price_history",
    headers: ["date", "symbol", "open", "high", "low", "close", "volume"]
  }
} as const;

type SheetName = keyof typeof SHEETS;
type AnyRecord = RecommendationRecord | HoldingRecord | PriceHistoryRecord;

export async function getRecommendations(): Promise<RecommendationRecord[]> {
  const rows = await readSheet("recommendations");
  return rows.map((row) => ({
    id: stringValue(row.id) || createId("rec"),
    date: stringValue(row.date),
    symbol: normalizeSymbol(row.symbol),
    target_price: toNumber(row.target_price),
    recommended_price: toNumber(row.recommended_price),
    recommender: stringValue(row.recommender),
    note: stringValue(row.note)
  }));
}

export async function createRecommendation(input: Omit<RecommendationRecord, "id">) {
  const record: RecommendationRecord = { id: createId("rec"), ...input, symbol: normalizeSymbol(input.symbol) };
  await appendSheet("recommendations", record);
  return record;
}

export async function updateRecommendation(id: string, input: Partial<Omit<RecommendationRecord, "id">>) {
  const records = await getRecommendations();
  const current = records.find((record) => record.id === id);
  if (!current) return null;
  const next: RecommendationRecord = { ...current, ...input, id, symbol: normalizeSymbol(input.symbol || current.symbol) };
  await replaceById("recommendations", id, next);
  return next;
}

export async function deleteRecommendation(id: string) {
  return deleteById("recommendations", id);
}

export async function getHoldings(): Promise<HoldingRecord[]> {
  const rows = await readSheet("holdings");
  return rows.map((row) => ({
    id: stringValue(row.id) || createId("holding"),
    symbol: normalizeSymbol(row.symbol),
    shares: toNumber(row.shares),
    avg_cost: toNumber(row.avg_cost),
    broker: stringValue(row.broker),
    account: stringValue(row.account),
    note: stringValue(row.note)
  }));
}

export async function createHolding(input: Omit<HoldingRecord, "id">) {
  const record: HoldingRecord = { id: createId("holding"), ...input, symbol: normalizeSymbol(input.symbol) };
  await appendSheet("holdings", record);
  return record;
}

export async function updateHolding(id: string, input: Partial<Omit<HoldingRecord, "id">>) {
  const records = await getHoldings();
  const current = records.find((record) => record.id === id);
  if (!current) return null;
  const next: HoldingRecord = { ...current, ...input, id, symbol: normalizeSymbol(input.symbol || current.symbol) };
  await replaceById("holdings", id, next);
  return next;
}

export async function deleteHolding(id: string) {
  return deleteById("holdings", id);
}

export async function getPriceHistory(symbols?: string[]): Promise<PriceHistoryRecord[]> {
  const filter = symbols ? new Set(symbols.map(normalizeSymbol)) : null;
  const rows = await readSheet("price_history");
  return rows
    .map((row) => ({
      date: stringValue(row.date),
      symbol: normalizeSymbol(row.symbol),
      open: toNumber(row.open),
      high: toNumber(row.high),
      low: toNumber(row.low),
      close: toNumber(row.close),
      volume: toNumber(row.volume)
    }))
    .filter((row) => row.date && row.symbol && (!filter || filter.has(row.symbol)));
}

async function readSheet(sheetName: SheetName): Promise<Record<string, string>[]> {
  if (!hasGoogleConfig()) return readLocalSheet(sheetName);
  const { client, config } = await createSheetsClient();
  const meta = SHEETS[sheetName];
  await ensureHeader(sheetName);
  const response = await client.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${meta.name}!A:Z`
  });
  const values = response.data.values || [];
  const headers = values[0] || meta.headers;
  return values.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

async function appendSheet(sheetName: SheetName, record: AnyRecord) {
  if (!hasGoogleConfig()) return appendLocalSheet(sheetName, record);
  const { client, config } = await createSheetsClient();
  const meta = SHEETS[sheetName];
  await ensureHeader(sheetName);
  await client.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `${meta.name}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [meta.headers.map((header) => valueForHeader(record, header))]
    }
  });
}

async function replaceById(sheetName: Exclude<SheetName, "price_history">, id: string, record: AnyRecord) {
  if (!hasGoogleConfig()) return replaceLocalById(sheetName, id, record);
  const rows = await readSheet(sheetName);
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return false;

  const { client, config } = await createSheetsClient();
  const meta = SHEETS[sheetName];
  const rowNumber = index + 2;
  await client.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${meta.name}!A${rowNumber}:Z${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [meta.headers.map((header) => valueForHeader(record, header))]
    }
  });
  return true;
}

async function deleteById(sheetName: Exclude<SheetName, "price_history">, id: string) {
  if (!hasGoogleConfig()) return deleteLocalById(sheetName, id);
  const rows = await readSheet(sheetName);
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return false;

  const { client, config } = await createSheetsClient();
  const spreadsheet = await client.spreadsheets.get({ spreadsheetId: config.spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.title === SHEETS[sheetName].name);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return false;

  await client.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: index + 1,
              endIndex: index + 2
            }
          }
        }
      ]
    }
  });
  return true;
}

async function ensureHeader(sheetName: SheetName) {
  const { client, config } = await createSheetsClient();
  const meta = SHEETS[sheetName];
  const current = await client.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${meta.name}!1:1`
  }).catch(() => null);

  if (current?.data.values?.[0]?.length) return;

  await client.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${meta.name}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[...meta.headers]] }
  });
}

async function createSheetsClient() {
  const config = getSheetConfig();
  const auth = new GoogleAuth({
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return { config, client: googleSheetsApi({ version: "v4", auth }) };
}

function getSheetConfig(): SheetConfig {
  return {
    spreadsheetId: process.env.GOOGLE_SHEET_ID || "",
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
  };
}

function hasGoogleConfig() {
  const config = getSheetConfig();
  return Boolean(config.spreadsheetId && config.clientEmail && config.privateKey);
}

const localPath = path.join(process.cwd(), ".local-data.json");

async function readLocalData(): Promise<Record<SheetName, Record<string, string>[]>> {
  try {
    return JSON.parse(await fs.readFile(localPath, "utf8"));
  } catch {
    return {
      recommendations: [
        {
          id: "rec_demo_2330",
          date: "2026-05-22",
          symbol: "2330",
          target_price: "1180",
          recommended_price: "950",
          recommender: "Tom",
          note: "Demo"
        },
        {
          id: "rec_demo_3661",
          date: "2026-05-22",
          symbol: "3661",
          target_price: "520",
          recommended_price: "410",
          recommender: "Alice",
          note: "Demo"
        }
      ],
      holdings: [
        {
          id: "holding_demo_2330",
          symbol: "2330",
          shares: "1000",
          avg_cost: "850",
          broker: "Demo Broker",
          account: "Main",
          note: "Demo"
        }
      ],
      price_history: []
    };
  }
}

async function writeLocalData(data: Record<SheetName, Record<string, string>[]>) {
  await fs.writeFile(localPath, JSON.stringify(data, null, 2));
}

async function readLocalSheet(sheetName: SheetName) {
  return (await readLocalData())[sheetName];
}

async function appendLocalSheet(sheetName: SheetName, record: AnyRecord) {
  const data = await readLocalData();
  data[sheetName].push(recordToRow(sheetName, record));
  await writeLocalData(data);
}

async function replaceLocalById(sheetName: Exclude<SheetName, "price_history">, id: string, record: AnyRecord) {
  const data = await readLocalData();
  const index = data[sheetName].findIndex((row) => row.id === id);
  if (index < 0) return false;
  data[sheetName][index] = recordToRow(sheetName, record);
  await writeLocalData(data);
  return true;
}

async function deleteLocalById(sheetName: Exclude<SheetName, "price_history">, id: string) {
  const data = await readLocalData();
  const before = data[sheetName].length;
  data[sheetName] = data[sheetName].filter((row) => row.id !== id);
  await writeLocalData(data);
  return data[sheetName].length !== before;
}

function recordToRow(sheetName: SheetName, record: AnyRecord) {
  return Object.fromEntries(SHEETS[sheetName].headers.map((header) => [header, String(valueForHeader(record, header) ?? "")]));
}

function valueForHeader(record: AnyRecord, header: string) {
  return (record as unknown as Record<string, string | number>)[header] ?? "";
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeSymbol(value: unknown) {
  return stringValue(value).match(/\d{4,6}/)?.[0] || "";
}
