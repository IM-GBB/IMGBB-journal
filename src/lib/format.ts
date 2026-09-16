export function money(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function roiPct(n: number | null) {
  if (n == null) return "—";
  const a = `${Math.abs(n).toFixed(2)}%`;
  return n < 0 ? `(${a})` : a;
}

export function tickerOf(instId: string) {
  return instId.replace("-SWAP", "").replace("-USDT", "USDT").replace(/-/g, "");
}

export function weekday(dateKst: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    new Date(`${dateKst}T12:00:00+09:00`).getDay()
  ];
}