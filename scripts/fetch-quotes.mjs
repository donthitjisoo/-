import { readFile, writeFile } from "node:fs/promises";

const watchlist = JSON.parse(await readFile(new URL("../watchlist.json", import.meta.url), "utf8"));
const codes = [...new Set(watchlist.map((stock) => String(stock.code || "").trim()).filter(Boolean))];

if (codes.length === 0) {
  await writeQuotes([]);
  process.exit(0);
}

const channels = codes.flatMap((code) => [`tse_${code}.tw`, `otc_${code}.tw`]).join("|");
const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Date.now()}`;
const response = await fetch(url, {
  headers: {
    "user-agent": "Mozilla/5.0 stock-tracker/1.0",
    referer: "https://mis.twse.com.tw/stock/index.jsp"
  }
});

if (!response.ok) {
  throw new Error(`TWSE request failed: HTTP ${response.status}`);
}

const payload = await response.json();
const items = Array.isArray(payload.msgArray) ? payload.msgArray : [];
const quotes = items.map(toQuote).filter((quote) => quote.code);

await writeQuotes(quotes);

function toQuote(item) {
  const last = firstValid(item.z, item.a?.split("_")[0], item.b?.split("_")[0], item.y);
  const previous = numberOrNull(item.y);
  const latest = numberOrNull(last);
  const changePercent = previous && latest ? ((latest - previous) / previous) * 100 : null;
  return {
    code: item.c || "",
    name: item.n || "",
    last,
    changePercent,
    volume: numberOrNull(item.v),
    open: firstValid(item.o),
    high: firstValid(item.h),
    low: firstValid(item.l),
    time: `${item.d || ""} ${item.t || ""}`.trim()
  };
}

async function writeQuotes(quotes) {
  await writeFile(
    new URL("../quotes.json", import.meta.url),
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        source: "TWSE MIS via GitHub Actions",
        quotes
      },
      null,
      2
    )}\n`
  );
}

function firstValid(...values) {
  return values.find((value) => value && value !== "-" && value !== "_") || "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}
