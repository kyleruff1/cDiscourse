/**
 * Stage 6.1.5.1 — Date formatter unit tests.
 */
import { formatDateTime, toIsoSafe, formatRelativeShort } from '../src/lib/formatDateTime';

describe('formatDateTime', () => {
  it('returns "—" for null / undefined / empty', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('renders an ISO string as a local date+time string', () => {
    const out = formatDateTime('2026-05-17T15:30:45Z');
    // Locale output varies by platform; just assert it contains both date and time digits.
    expect(out).toMatch(/\d/);
    expect(out.length).toBeGreaterThan(8);
  });

  it('renders a Date instance', () => {
    expect(formatDateTime(new Date('2026-05-17T00:00:00Z')).length).toBeGreaterThan(0);
  });

  it('returns the original string when value is unparseable', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });
});

describe('toIsoSafe', () => {
  it('returns empty for null / undefined / empty', () => {
    expect(toIsoSafe(null)).toBe('');
    expect(toIsoSafe(undefined)).toBe('');
    expect(toIsoSafe('')).toBe('');
  });
  it('returns ISO for valid input', () => {
    expect(toIsoSafe('2026-05-17T15:30:45Z')).toBe('2026-05-17T15:30:45.000Z');
  });
  it('returns empty for unparseable', () => {
    expect(toIsoSafe('nope')).toBe('');
  });
});

describe('formatRelativeShort', () => {
  const now = Date.UTC(2026, 4, 17, 12, 0, 0); // 2026-05-17T12:00:00Z
  it('seconds ago', () => {
    const earlier = new Date(now - 5_000).toISOString();
    expect(formatRelativeShort(earlier, now)).toBe('5s ago');
  });
  it('minutes ago', () => {
    const earlier = new Date(now - 120_000).toISOString();
    expect(formatRelativeShort(earlier, now)).toBe('2m ago');
  });
  it('hours ago', () => {
    const earlier = new Date(now - 7_200_000).toISOString();
    expect(formatRelativeShort(earlier, now)).toBe('2h ago');
  });
  it('days ago', () => {
    const earlier = new Date(now - 86_400_000 * 3).toISOString();
    expect(formatRelativeShort(earlier, now)).toBe('3d ago');
  });
  it('returns empty for null / unparseable', () => {
    expect(formatRelativeShort(null)).toBe('');
    expect(formatRelativeShort('nope')).toBe('');
  });
});
