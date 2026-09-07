/** Shared formatting, so the same number reads the same way everywhere. */

export function fmtHours(hours: number): string {
  const mins = Math.round(hours * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function parseDateInput(value: string): Date | null {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts as [number, number, number];
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateInput(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export const mi = (n: number): string => `${Math.round(n).toLocaleString()} mi`;

/**
 * Miles where the value can be small. Rounding to whole miles turns two adjacent
 * chargers into "0 mi", and some really are a few hundred feet apart, so anything
 * under ten miles keeps a decimal.
 */
export const shortMi = (n: number): string =>
  n < 10 ? `${(Math.round(n * 10) / 10).toFixed(1)} mi` : mi(n);
