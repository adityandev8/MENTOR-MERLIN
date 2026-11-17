import type { IsoDate } from '@hotel/shared';

/**
 * Hotel stays are calendar dates, not instants. We represent them as
 * "YYYY-MM-DD" strings in the API and as UTC-midnight `Date`s in MongoDB so a
 * date never shifts when servers run in different time zones. "Today" is always
 * computed in the hotel's configured time zone.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isoToUtcDate(value: IsoDate): Date {
  if (!isValidIsoDate(value)) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function utcDateToIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Calendar date "now" in the given IANA time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return utcDateToIso(new Date(isoToUtcDate(value).getTime() + days * MS_PER_DAY));
}

export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): number {
  return Math.round((isoToUtcDate(checkOut).getTime() - isoToUtcDate(checkIn).getTime()) / MS_PER_DAY);
}

/** Each night of a stay: from check-in (inclusive) to check-out (exclusive). */
export function eachNight(checkIn: IsoDate, checkOut: IsoDate): IsoDate[] {
  const count = nightsBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(checkIn, i));
}

export function maxIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}
