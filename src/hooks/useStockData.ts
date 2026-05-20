import { useEffect, useMemo, useState } from "react";
import { loadStaticData } from "../services/stockDataService";
import type { StaticDataBundle, StockQuote } from "../types/stock";

interface StockDataState {
  data: StaticDataBundle | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useStockData(): StockDataState {
  const [data, setData] = useState<StaticDataBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadStaticData()
      .then((bundle) => {
        if (!cancelled) setData(bundle);
      })
      .catch((nextError: Error) => {
        if (!cancelled) setError(nextError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return {
    data,
    isLoading: !data && !error,
    error,
    reload: () => setVersion((current) => current + 1)
  };
}

export function useQuoteIndex(data: StaticDataBundle | null): Map<string, StockQuote> {
  return useMemo(() => new Map(data?.market.quotes.map((quote) => [quote.symbol, quote]) || []), [data]);
}
