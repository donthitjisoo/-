import { useCallback, useMemo, useState } from "react";
import { parseRecommendationCsv } from "../lib/recommendationCsv";
import type { RecommendationInput, StockSheet } from "../types/stock";

const STORAGE_KEY = "csv-recommendation-sheets-v1";

const DEFAULT_SHEETS: StockSheet[] = [
  {
    id: "semiconductor",
    name: "半導體",
    recommendations: [
      recommendation("2330", 2400, "系統", "2026-05-20", false),
      recommendation("2454", 3500, "系統", "2026-05-20", false)
    ]
  },
  {
    id: "swing",
    name: "波段",
    recommendations: [
      recommendation("2327", 600, "Kevin", "2026-05-20", false),
      recommendation("3163", 1000, "Kevin", "2026-05-20", false)
    ]
  }
];

export function useRecommendationSheets() {
  const [state, setState] = useState<SheetState>(() => loadState());
  const activeSheet = useMemo(
    () => state.sheets.find((sheet) => sheet.id === state.activeSheetId) || state.sheets[0],
    [state]
  );

  const persist = useCallback((nextState: SheetState) => {
    setState(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }, []);

  const setActiveSheetId = useCallback(
    (activeSheetId: string) => persist({ ...state, activeSheetId }),
    [persist, state]
  );

  const addSheet = useCallback(
    (name: string) => {
      const sheet = { id: createId(), name, recommendations: [] };
      persist({ activeSheetId: sheet.id, sheets: [...state.sheets, sheet] });
    },
    [persist, state.sheets]
  );

  const importCsvToActiveSheet = useCallback(
    async (file: File) => {
      const records = parseRecommendationCsv(await file.text());
      const imported = records.map((record) =>
        recommendation(record.symbol, record.targetPrice, record.recommender, record.date, record.targetReached, record.reachedDays)
      );
      const nextSheets = state.sheets.map((sheet) =>
        sheet.id === activeSheet.id ? { ...sheet, recommendations: imported } : sheet
      );
      persist({ ...state, sheets: nextSheets });
      return imported.length;
    },
    [activeSheet.id, persist, state]
  );

  return {
    sheets: state.sheets,
    activeSheet,
    setActiveSheetId,
    addSheet,
    importCsvToActiveSheet
  };
}

interface SheetState {
  activeSheetId: string;
  sheets: StockSheet[];
}

function loadState(): SheetState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      return defaultState();
    }
  }
  return defaultState();
}

function normalizeState(value: Partial<SheetState>): SheetState {
  const sheets = Array.isArray(value.sheets) && value.sheets.length > 0 ? value.sheets : DEFAULT_SHEETS;
  const activeSheetId = value.activeSheetId && sheets.some((sheet) => sheet.id === value.activeSheetId) ? value.activeSheetId : sheets[0].id;
  return { activeSheetId, sheets };
}

function defaultState(): SheetState {
  return { activeSheetId: DEFAULT_SHEETS[0].id, sheets: DEFAULT_SHEETS };
}

function recommendation(
  symbol: string,
  targetPrice: number,
  analyst: string,
  recommendationDate: string,
  targetReached: boolean,
  reachedDays?: number
): RecommendationInput {
  return {
    symbol,
    targetPrice,
    recommendationPrice: 0,
    recommendationDate,
    analyst,
    rating: "",
    targetReached,
    reachedDays
  };
}

function createId(): string {
  return `watchlist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
