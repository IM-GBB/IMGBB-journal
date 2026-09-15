const SEOUL = "Asia/Seoul";

export function kstDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function kstRangeUtcMs(dateKst: string): { begin: number; end: number } {
  const begin = Date.parse(`${dateKst}T00:00:00+09:00`);
  const next = new Date(begin + 36 * 3600 * 1000);
  const nextKey = kstDateKey(next);
  const end = Date.parse(`${nextKey}T00:00:00+09:00`);
  return { begin, end };
}

export function isValidDateKey(dateKst: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKst) && !Number.isNaN(Date.parse(`${dateKst}T00:00:00+09:00`));
}

export function shiftDate(dateKst: string, days: number): string {
  const t = Date.parse(`${dateKst}T12:00:00+09:00`) + days * 86400000;
  return kstDateKey(new Date(t));
}

export function monthKey(dateKst: string): string {
  return dateKst.slice(0, 7);
}

export function yearKey(dateKst: string): string {
  return dateKst.slice(0, 4);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
