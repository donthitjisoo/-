const STORAGE_KEY = "rocket-stock-tracker-v2";
const LEGACY_STORAGE_KEY = "rocket-stock-tracker-v1";
const DEFAULT_LISTS = [
  {
    id: "watch",
    name: "觀察清單",
    stocks: [
      { code: "2330", target: "", rating: "觀察", note: "" },
      { code: "2454", target: "", rating: "觀察", note: "" },
      { code: "2317", target: "", rating: "觀察", note: "" }
    ]
  },
  {
    id: "rocket",
    name: "飆股候選",
    stocks: [
      { code: "2327", target: "", rating: "買進", note: "" },
      { code: "3163", target: "", rating: "觀察", note: "" }
    ]
  }
];

const state = {
  lists: loadLists(),
  activeListId: "",
  quotes: new Map(),
  sortKey: "code",
  sortDirection: "asc",
  filter: ""
};

state.activeListId = loadActiveListId();

const els = {
  addForm: document.querySelector("#add-form"),
  listForm: document.querySelector("#list-form"),
  listTabs: document.querySelector("#list-tabs"),
  listName: document.querySelector("#list-name"),
  query: document.querySelector("#stock-query"),
  options: document.querySelector("#stock-options"),
  target: document.querySelector("#target-price"),
  rating: document.querySelector("#rating"),
  title: document.querySelector("#active-list-title"),
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
  const match = resolveStock(els.query.value);
  if (!match?.code) {
    setStatus("請輸入有效的股票代號或名稱。", "warn");
    return;
  }

  const list = activeList();
  const existing = list.stocks.find((stock) => stock.code === match.code);
  const next = {
    code: match.code,
    target: cleanNumber(els.target.value),
    rating: els.rating.value,
    note: existing?.note || ""
  };

  if (existing) {
    Object.assign(existing, next);
    setStatus(`${match.code} ${displayName(match.code)} 已更新。`);
  } else {
    list.stocks.push(next);
    setStatus(`${match.code} ${displayName(match.code)} 已加入「${list.name}」。`);
  }

  els.addForm.reset();
  saveLists();
  render();
});

els.listForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.listName.value.trim();
  if (!name) return;
  const list = { id: createId(), name, stocks: [] };
  state.lists.push(list);
  state.activeListId = list.id;
  els.listForm.reset();
  saveLists();
  render();
});

els.refresh.addEventListener("click", () => refreshQuotes());
els.export.addEventListener("click", exportCsv);
els.importFile.addEventListener("change", importCsv);
els.search.addEventListener("input", () => {
  state.filter = els.search.value.trim().toLowerCase();
  renderTable();
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
    renderTable();
  });
});

function loadLists() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed?.lists)) return normalizeLists(parsed.lists);
    } catch {
      return cloneDefaultLists();
    }
  }

  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      const stocks = JSON.parse(legacy);
      if (Array.isArray(stocks)) {
        return normalizeLists([
          {
            id: "watch",
            name: "觀察清單",
            stocks: stocks.map((stock) => ({
              code: stock.code,
              target: stock.target || "",
              rating: stock.rating || "觀察",
              note: stock.note || ""
            }))
          }
        ]);
      }
    } catch {
      return cloneDefaultLists();
    }
  }

  return cloneDefaultLists();
}

function loadActiveListId() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (state.lists.some((list) => list.id === parsed.activeListId)) return parsed.activeListId;
    } catch {
      return state.lists[0]?.id || "";
    }
  }
  return state.lists[0]?.id || "";
}

function saveLists() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeListId: state.activeListId,
      lists: state.lists
    })
  );
}

function normalizeLists(lists) {
  const normalized = lists
    .filter((list) => list && Array.isArray(list.stocks))
    .map((list, index) => ({
      id: list.id || createId(),
      name: list.name || `清單 ${index + 1}`,
      stocks: list.stocks
        .map((stock) => ({
          code: normalizeCode(stock.code),
          target: cleanNumber(stock.target),
          rating: stock.rating || "",
          note: stock.note || ""
        }))
        .filter((stock) => stock.code)
    }));
  return normalized.length > 0 ? normalized : cloneDefaultLists();
}

function cloneDefaultLists() {
  return JSON.parse(JSON.stringify(DEFAULT_LISTS));
}

function activeList() {
  return state.lists.find((list) => list.id === state.activeListId) || state.lists[0];
}

function render() {
  renderTabs();
  renderOptions();
  renderTable();
}

function renderTabs() {
  const list = activeList();
  els.title.textContent = list?.name || "觀察清單";
  els.listTabs.textContent = "";

  state.lists.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.id === state.activeListId ? "active" : "";
    button.textContent = `${item.name} ${item.stocks.length}`;
    button.addEventListener("click", () => {
      state.activeListId = item.id;
      saveLists();
      render();
    });
    els.listTabs.appendChild(button);
  });
}

function renderOptions() {
  const options = [...state.quotes.values()]
    .filter((quote) => quote.code && quote.name)
    .sort((a, b) => a.code.localeCompare(b.code))
    .slice(0, 3500);

  els.options.textContent = "";
  options.forEach((quote) => {
    const option = document.createElement("option");
    option.value = `${quote.code} ${quote.name}`;
    els.options.appendChild(option);
  });
}

function renderTable() {
  const list = activeList();
  const rows = sortedStocks(list.stocks).filter((stock) => {
    const quote = state.quotes.get(stock.code);
    const keyword = `${stock.code} ${quote?.name || ""} ${stock.rating || ""} ${stock.note || ""}`.toLowerCase();
    return keyword.includes(state.filter);
  });

  els.body.textContent = "";
  els.count.textContent = list.stocks.length;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty-row";
    tr.innerHTML = '<td colspan="10">目前沒有符合條件的股票。</td>';
    els.body.appendChild(tr);
    return;
  }

  rows.forEach((stock) => {
    const quote = state.quotes.get(stock.code);
    const row = els.template.content.firstElementChild.cloneNode(true);
    const last = numberOrNull(quote?.last);
    const target = numberOrNull(stock.target);

    row.querySelector(".code-cell").textContent = stock.code;
    row.querySelector(".name-cell").textContent = displayName(stock.code);
    row.querySelector(".last-cell").textContent = formatNumber(last);
    row.querySelector(".change-cell").textContent = formatPercent(quote?.changePercent);
    row.querySelector(".volume-cell").textContent = formatVolume(quote?.volume);
    row.querySelector(".ohl-cell").textContent = quote ? `${formatPlain(quote.open)} / ${formatPlain(quote.high)} / ${formatPlain(quote.low)}` : "-";

    const changeCell = row.querySelector(".change-cell");
    const change = numberOrNull(quote?.changePercent);
    if (change > 0) changeCell.classList.add("gain");
    if (change < 0) changeCell.classList.add("loss");
    if (target !== null && last !== null && last >= target) row.classList.add("target-hit");

    const targetInput = row.querySelector(".target-input");
    targetInput.value = stock.target || "";
    targetInput.addEventListener("change", () => {
      stock.target = cleanNumber(targetInput.value);
      saveLists();
      renderTable();
    });

    const ratingInput = row.querySelector(".rating-input");
    ratingInput.value = stock.rating || "";
    ratingInput.addEventListener("change", () => {
      stock.rating = ratingInput.value;
      saveLists();
    });

    const noteInput = row.querySelector(".note-input");
    noteInput.value = stock.note || "";
    noteInput.addEventListener("change", () => {
      stock.note = noteInput.value.trim();
      saveLists();
    });

    row.querySelector(".remove-btn").addEventListener("click", () => {
      list.stocks = list.stocks.filter((item) => item.code !== stock.code);
      saveLists();
      render();
    });

    els.body.appendChild(row);
  });
}

function sortedStocks(stocks) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  return [...stocks].sort((a, b) => {
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
  if (key === "name") return quote.name || "";
  if (key === "last") return numberOrNull(quote.last) ?? -Infinity;
  if (key === "changePercent") return numberOrNull(quote.changePercent) ?? -Infinity;
  if (key === "volume") return numberOrNull(quote.volume) ?? -Infinity;
  return stock.code;
}

async function refreshQuotes(options = {}) {
  if (!options.quiet) setStatus("更新報價中...");

  try {
    const cached = await fetchCachedQuotes();
    if (cached.quotes.size > 0) {
      applyQuotes({
        quotes: cached.quotes,
        source: cached.source || "GitHub Actions 快取",
        updatedAt: cached.updatedAt,
        status: `已載入 ${cached.quotes.size} 檔快取，輸入代號或名稱會自動帶出資料。`
      });
      return;
    }
  } catch (error) {
    setStatus(`報價快取尚未可用：${error.message}`, "warn");
    return;
  }

  setStatus("目前沒有可顯示的報價。", "warn");
}

function applyQuotes({ quotes, source, updatedAt, status }) {
  quotes.forEach((quote, code) => state.quotes.set(code, quote));
  els.updated.textContent = updatedAt ? formatDateTime(updatedAt) : new Date().toLocaleTimeString("zh-TW", { hour12: false });
  els.source.textContent = source;
  setStatus(status);
  render();
}

async function fetchCachedQuotes() {
  const response = await fetch(`quotes.json?_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("找不到 GitHub Actions 報價快取");
  const payload = await response.json();
  if (!Array.isArray(payload.quotes)) throw new Error("報價快取格式不符合預期");

  const quotes = new Map();
  payload.quotes.forEach((quote) => {
    if (quote.code) quotes.set(String(quote.code), quote);
  });
  return {
    quotes,
    updatedAt: payload.updatedAt || "",
    source: payload.source || ""
  };
}

function resolveStock(value) {
  const text = String(value || "").trim();
  const code = normalizeCode(text);
  if (code) return { code };

  const normalized = normalizeText(text);
  if (!normalized) return null;
  return [...state.quotes.values()].find((quote) => normalizeText(quote.name).includes(normalized)) || null;
}

function displayName(code) {
  return state.quotes.get(code)?.name || "";
}

function exportCsv() {
  const list = activeList();
  const header = ["list", "code", "name", "target", "rating", "note", "last", "changePercent", "volume", "open", "high", "low"];
  const lines = list.stocks.map((stock) => {
    const quote = state.quotes.get(stock.code) || {};
    return [
      list.name,
      stock.code,
      quote.name || "",
      stock.target || "",
      stock.rating || "",
      stock.note || "",
      quote.last || "",
      quote.changePercent ?? "",
      quote.volume ?? "",
      quote.open || "",
      quote.high || "",
      quote.low || ""
    ].map(csvCell).join(",");
  });
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${list.name}-${new Date().toISOString().slice(0, 10)}.csv`;
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
  const list = activeList();

  dataRows.forEach((row) => {
    const code = normalizeCode(row[indexes.code] || row[0]);
    if (!code) return;
    const existing = list.stocks.find((stock) => stock.code === code);
    const next = {
      code,
      target: cleanNumber(row[indexes.target] || ""),
      rating: row[indexes.rating] || "",
      note: row[indexes.note] || ""
    };
    if (existing) Object.assign(existing, next);
    else list.stocks.push(next);
  });

  event.target.value = "";
  saveLists();
  render();
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

function createId() {
  return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeCode(value) {
  const match = String(value || "").match(/\d{4,6}/);
  return match ? match[0] : "";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanNumber(value) {
  return String(value || "").replace(/[^\d.]/g, "");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  return value === null ? "-" : value.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

function formatPlain(value) {
  const number = numberOrNull(value);
  return number === null ? "-" : number.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

function formatPercent(value) {
  const number = numberOrNull(value);
  return number === null ? "-" : `${number.toFixed(2)}%`;
}

function formatVolume(value) {
  const number = numberOrNull(value);
  return number === null ? "-" : number.toLocaleString("zh-TW");
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
