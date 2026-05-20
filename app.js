const STORAGE_KEY = "rocket-stock-tracker-v1";
const DEFAULT_STOCKS = [
  { code: "2330", name: "台積電", target: "", note: "" },
  { code: "2454", name: "聯發科", target: "", note: "" },
  { code: "2317", name: "鴻海", target: "", note: "" }
];

const state = {
  stocks: loadStocks(),
  quotes: new Map(),
  sortKey: "code",
  sortDirection: "asc",
  filter: ""
};

const els = {
  addForm: document.querySelector("#add-form"),
  code: document.querySelector("#stock-code"),
  name: document.querySelector("#stock-name"),
  target: document.querySelector("#target-price"),
  body: document.querySelector("#stock-body"),
  template: document.querySelector("#row-template"),
  refresh: document.querySelector("#refresh-btn"),
  export: document.querySelector("#export-btn"),
  importFile: document.querySelector("#import-file"),
  search: document.querySelector("#search-input"),
  count: document.querySelector("#stat-count"),
  updated: document.querySelector("#stat-updated"),
  source: document.querySelector("#stat-source"),
  status: document.querySelector("#status-line"),
  marketDot: document.querySelector("#market-dot"),
  marketLabel: document.querySelector("#market-label")
};

render();
setMarketState();
refreshQuotes();
window.setInterval(setMarketState, 60_000);
window.setInterval(() => refreshQuotes({ quiet: true }), 60_000);

els.addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = normalizeCode(els.code.value);
  if (!code) {
    setStatus("請輸入股票代號。", "warn");
    return;
  }

  const existing = state.stocks.find((stock) => stock.code === code);
  if (existing) {
    existing.name = els.name.value.trim() || existing.name;
    existing.target = cleanNumber(els.target.value);
    setStatus(`${code} 已更新。`);
  } else {
    state.stocks.push({
      code,
      name: els.name.value.trim(),
      target: cleanNumber(els.target.value),
      note: ""
    });
    setStatus(`${code} 已加入觀察清單。`);
  }

  els.addForm.reset();
  saveStocks();
  render();
  refreshQuotes();
});

els.refresh.addEventListener("click", () => refreshQuotes());
els.export.addEventListener("click", exportCsv);
els.importFile.addEventListener("change", importCsv);
els.search.addEventListener("input", () => {
  state.filter = els.search.value.trim().toLowerCase();
  render();
});

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = key;
      state.sortDirection = "asc";
    }
    render();
  });
});

function loadStocks() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [...DEFAULT_STOCKS];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_STOCKS];
  } catch {
    return [...DEFAULT_STOCKS];
  }
}

function saveStocks() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stocks));
}

function render() {
  const rows = sortedStocks().filter((stock) => {
    const keyword = `${stock.code} ${stock.name}`.toLowerCase();
    return keyword.includes(state.filter);
  });

  els.body.textContent = "";
  els.count.textContent = state.stocks.length;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty-row";
    tr.innerHTML = '<td colspan="9">目前沒有符合條件的股票。</td>';
    els.body.appendChild(tr);
    return;
  }

  rows.forEach((stock) => {
    const quote = state.quotes.get(stock.code);
    const row = els.template.content.firstElementChild.cloneNode(true);
    const last = numberOrNull(quote?.last);
    const target = numberOrNull(stock.target);

    row.querySelector(".code-cell").textContent = stock.code;
    row.querySelector(".name-cell").textContent = quote?.name || stock.name || "-";
    row.querySelector(".last-cell").textContent = formatNumber(last);
    row.querySelector(".change-cell").textContent = formatPercent(quote?.changePercent);
    row.querySelector(".volume-cell").textContent = formatVolume(quote?.volume);
    row.querySelector(".ohl-cell").textContent = quote ? `${quote.open || "-"} / ${quote.high || "-"} / ${quote.low || "-"}` : "-";

    const changeCell = row.querySelector(".change-cell");
    const change = numberOrNull(quote?.changePercent);
    if (change > 0) changeCell.classList.add("gain");
    if (change < 0) changeCell.classList.add("loss");
    if (target !== null && last !== null && last >= target) row.classList.add("target-hit");

    const targetInput = row.querySelector(".target-input");
    targetInput.value = stock.target || "";
    targetInput.addEventListener("change", () => {
      stock.target = cleanNumber(targetInput.value);
      saveStocks();
      render();
    });

    const noteInput = row.querySelector(".note-input");
    noteInput.value = stock.note || "";
    noteInput.addEventListener("change", () => {
      stock.note = noteInput.value.trim();
      saveStocks();
    });

    row.querySelector(".remove-btn").addEventListener("click", () => {
      state.stocks = state.stocks.filter((item) => item.code !== stock.code);
      state.quotes.delete(stock.code);
      saveStocks();
      render();
    });

    els.body.appendChild(row);
  });
}

function sortedStocks() {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  return [...state.stocks].sort((a, b) => {
    const quoteA = state.quotes.get(a.code) || {};
    const quoteB = state.quotes.get(b.code) || {};
    const valueA = valueForSort(a, quoteA, state.sortKey);
    const valueB = valueForSort(b, quoteB, state.sortKey);
    if (valueA > valueB) return direction;
    if (valueA < valueB) return -direction;
    return a.code.localeCompare(b.code) * direction;
  });
}

function valueForSort(stock, quote, key) {
  if (key === "name") return quote.name || stock.name || "";
  if (key === "last") return numberOrNull(quote.last) ?? -Infinity;
  if (key === "changePercent") return numberOrNull(quote.changePercent) ?? -Infinity;
  if (key === "volume") return numberOrNull(quote.volume) ?? -Infinity;
  return stock.code;
}

async function refreshQuotes(options = {}) {
  if (state.stocks.length === 0) return;
  if (!options.quiet) setStatus("更新報價中...");

  const codes = state.stocks.map((stock) => stock.code);
  let source = "";
  let cacheUpdatedAt = "";
  let quotes = new Map();
  let fallbackMessage = "";

  try {
    const cached = await fetchCachedQuotes();
    quotes = cached.quotes;
    source = "GitHub Actions 快取";
    cacheUpdatedAt = cached.updatedAt;
  } catch (error) {
    if (!options.quiet) setStatus(`報價快取尚未可用，改抓即時資料：${error.message}`);
  }

  try {
    const liveQuotes = await fetchLiveQuotes(codes);
    if (liveQuotes.size > 0) {
      quotes = liveQuotes;
      source = liveQuotes.source || "即時報價";
      cacheUpdatedAt = "";
    }
  } catch (error) {
    if (quotes.size === 0) {
      setStatus(`即時資料暫時無法讀取：${error.message}`, "warn");
      return;
    }
    fallbackMessage = `即時資料暫時無法讀取，先顯示快取：${error.message}`;
  }

  quotes.forEach((quote, code) => state.quotes.set(code, quote));
  els.updated.textContent = cacheUpdatedAt ? formatDateTime(cacheUpdatedAt) : new Date().toLocaleTimeString("zh-TW", { hour12: false });
  els.source.textContent = source || "TWSE MIS";
  setStatus(fallbackMessage || (quotes.size > 0 ? `已更新 ${quotes.size} 檔。` : "尚未有報價快取，部署後可先手動執行 GitHub Action。"), fallbackMessage ? "warn" : "normal");
  render();
}

async function fetchLiveQuotes(codes) {
  const providers = [
    { name: "TWSE MIS 即時", fetchQuotes: fetchTwseQuotes },
    { name: "Yahoo Finance 即時", fetchQuotes: fetchYahooQuotes }
  ];
  const quotes = new Map();
  const sources = [];
  const failures = [];

  for (const provider of providers) {
    const missingCodes = codes.filter((code) => !quotes.has(code));
    if (missingCodes.length === 0) break;

    try {
      const providerQuotes = await provider.fetchQuotes(missingCodes);
      providerQuotes.forEach((quote, code) => {
        if (!quotes.has(code)) quotes.set(code, quote);
      });
      if (providerQuotes.size > 0) sources.push(provider.name);
    } catch (error) {
      failures.push(`${provider.name}: ${error.message}`);
    }
  }

  if (quotes.size === 0 && failures.length > 0) {
    throw new Error(failures.join("；"));
  }

  quotes.source = sources.join(" + ");
  return quotes;
}

async function fetchTwseQuotes(codes) {
  const channels = codes.flatMap((code) => [`tse_${code}.tw`, `otc_${code}.tw`]).join("|");
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(channels)}&json=1&delay=0&_=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  if (!Array.isArray(payload.msgArray)) throw new Error("資料格式不符合預期");

  const quotes = new Map();
  payload.msgArray.forEach((item) => {
    const code = item.c;
    const last = firstValid(item.z, item.a?.split("_")[0], item.b?.split("_")[0], item.y);
    const previous = numberOrNull(item.y);
    const latest = numberOrNull(last);
    const changePercent = previous && latest ? ((latest - previous) / previous) * 100 : null;
    quotes.set(code, {
      code,
      name: item.n,
      last,
      changePercent,
      volume: numberOrNull(item.v),
      open: firstValid(item.o),
      high: firstValid(item.h),
      low: firstValid(item.l),
      time: `${item.d || ""} ${item.t || ""}`.trim()
    });
  });
  return quotes;
}

async function fetchYahooQuotes(codes) {
  const entries = await Promise.all(codes.map(fetchYahooQuote));
  return new Map(entries.filter(Boolean).map((quote) => [quote.code, quote]));
}

async function fetchYahooQuote(code) {
  for (const suffix of [".TW", ".TWO"]) {
    const quote = await fetchYahooSymbol(code, `${code}${suffix}`);
    if (quote) return quote;
  }
  return null;
}

async function fetchYahooSymbol(code, symbol) {
  let payload = null;

  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&_=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) continue;

    payload = await response.json();
    break;
  }

  if (!payload) return null;

  const result = payload?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const close = lastNumber(quote.close);
  const last = numberOrNull(meta.regularMarketPrice) ?? close;
  if (last === null) return null;

  const previous = numberOrNull(meta.chartPreviousClose) ?? numberOrNull(meta.previousClose);
  const changePercent = previous ? ((last - previous) / previous) * 100 : null;
  const timestamp = lastNumber(result.timestamp);

  return {
    code,
    name: meta.shortName || meta.symbol || "",
    last,
    changePercent,
    volume: numberOrNull(meta.regularMarketVolume) ?? lastNumber(quote.volume),
    open: firstNumber(quote.open),
    high: maxNumber(quote.high),
    low: minNumber(quote.low),
    time: timestamp ? new Date(timestamp * 1000).toISOString() : "",
    source: "Yahoo Finance"
  };
}

async function fetchCachedQuotes() {
  const response = await fetch(`quotes.json?_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("找不到 GitHub Actions 報價快取");
  const payload = await response.json();
  if (!Array.isArray(payload.quotes)) throw new Error("報價快取格式不符合預期");

  const quotes = new Map();
  payload.quotes.forEach((quote) => {
    if (quote.code) quotes.set(quote.code, quote);
  });
  return {
    quotes,
    updatedAt: payload.updatedAt || ""
  };
}

function exportCsv() {
  const header = ["code", "name", "target", "note", "last", "changePercent", "volume"];
  const lines = state.stocks.map((stock) => {
    const quote = state.quotes.get(stock.code) || {};
    return [
      stock.code,
      quote.name || stock.name || "",
      stock.target || "",
      stock.note || "",
      quote.last || "",
      quote.changePercent ?? "",
      quote.volume ?? ""
    ].map(csvCell).join(",");
  });
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stock-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  const [header, ...dataRows] = rows;
  const indexes = Object.fromEntries(header.map((name, index) => [name.trim().toLowerCase(), index]));

  dataRows.forEach((row) => {
    const code = normalizeCode(row[indexes.code] || row[0]);
    if (!code) return;
    const existing = state.stocks.find((stock) => stock.code === code);
    const next = {
      code,
      name: row[indexes.name] || row[1] || "",
      target: cleanNumber(row[indexes.target] || ""),
      note: row[indexes.note] || ""
    };
    if (existing) Object.assign(existing, next);
    else state.stocks.push(next);
  });

  event.target.value = "";
  saveStocks();
  render();
  refreshQuotes();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
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

function setMarketState() {
  const isOpen = isMarketOpen();
  els.marketDot.className = `dot ${isOpen ? "open" : "closed"}`;
  els.marketLabel.textContent = isOpen ? "台股盤中" : "非台股交易時段";
}

function isMarketOpen() {
  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  return isWeekday && minutes >= 9 * 60 && minutes <= 13 * 60 + 30;
}

function setStatus(message, type = "normal") {
  els.status.textContent = message;
  els.status.style.color = type === "warn" ? "var(--warn)" : "var(--muted)";
}

function normalizeCode(value) {
  const match = String(value || "").match(/\d{4,6}/);
  return match ? match[0] : "";
}

function cleanNumber(value) {
  const number = String(value || "").replace(/[^\d.]/g, "");
  return number;
}

function firstValid(...values) {
  return values.find((value) => value && value !== "-" && value !== "_") || "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  return value === null ? "-" : value.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

function formatPercent(value) {
  const number = numberOrNull(value);
  return number === null ? "-" : `${number.toFixed(2)}%`;
}

function formatVolume(value) {
  const number = numberOrNull(value);
  return number === null ? "-" : number.toLocaleString("zh-TW");
}

function firstNumber(values = []) {
  return values.map(numberOrNull).find((value) => value !== null) ?? null;
}

function lastNumber(values = []) {
  return [...values].reverse().map(numberOrNull).find((value) => value !== null) ?? null;
}

function maxNumber(values = []) {
  const numbers = values.map(numberOrNull).filter((value) => value !== null);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function minNumber(values = []) {
  const numbers = values.map(numberOrNull).filter((value) => value !== null);
  return numbers.length > 0 ? Math.min(...numbers) : null;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
