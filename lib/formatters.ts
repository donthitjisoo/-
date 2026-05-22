export function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value || 0);
}

export function formatPercent(value: number, digits = 2) {
  return `${formatNumber(value, digits)}%`;
}

export function formatSignedPercent(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value, digits)}`;
}

export function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCurrency(value)}`;
}
