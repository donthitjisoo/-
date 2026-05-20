import { useMemo, useState } from "react";

export function useVirtualRows<T>(rows: T[], rowHeight: number, viewportHeight: number, overscan = 8) {
  const [scrollTop, setScrollTop] = useState(0);
  const virtual = useMemo(() => {
    const startIndex = Math.max(Math.floor(scrollTop / rowHeight) - overscan, 0);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const endIndex = Math.min(startIndex + visibleCount, rows.length);
    return {
      rows: rows.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      offsetTop: startIndex * rowHeight,
      totalHeight: rows.length * rowHeight
    };
  }, [overscan, rowHeight, rows, scrollTop, viewportHeight]);

  return { ...virtual, setScrollTop };
}
