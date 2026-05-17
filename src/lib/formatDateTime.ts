/**
 * Local-time date+time formatter shared across the Admin UI.
 *
 * Pure TypeScript. No network. Timezone-safe: if the input is unparseable,
 * the original string is returned so admins still see something.
 */

const LOCALE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  let d: Date;
  if (value instanceof Date) d = value;
  else d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleString(undefined, LOCALE_OPTIONS);
  } catch {
    // Fallback if Intl is unavailable (very old engines)
    return d.toISOString();
  }
}

/** ISO fallback — useful when sorting / serializing rather than displaying. */
export function toIsoSafe(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  let d: Date;
  if (value instanceof Date) d = value;
  else d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Relative-time supplement (kept terse — never the sole timestamp display). */
export function formatRelativeShort(value: string | number | Date | null | undefined, nowMs?: number): string {
  if (value === null || value === undefined || value === '') return '';
  let d: Date;
  if (value instanceof Date) d = value;
  else d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const diffSec = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}
