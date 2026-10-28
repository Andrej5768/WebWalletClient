import dayjs from 'dayjs';
import type { Schemas } from '../../api/client';
import { isoDate } from '../../lib/periods';

export type ComparePreset = 'mom' | 'yoy' | 'custom';

export interface ComparePeriods {
  fromA: string;
  toA: string;
  fromB: string;
  toB: string;
}

/**
 * Period A is the current month, period B the month before (month to month) or the same month a year ago (year to
 * year). With `sameDate` both end on today's day of the month, so a half-gone month is not compared with a whole one.
 */
export function comparePeriods(
  preset: Exclude<ComparePreset, 'custom'>,
  today: dayjs.Dayjs,
  sameDate: boolean,
) {
  const startA = today.startOf('month');
  const startB = preset === 'mom' ? startA.subtract(1, 'month') : startA.subtract(1, 'year');
  return truncate(
    {
      fromA: isoDate(startA),
      toA: isoDate(startA.endOf('month')),
      fromB: isoDate(startB),
      toB: isoDate(startB.endOf('month')),
    },
    sameDate ? today.diff(startA, 'day') + 1 : null,
  );
}

/** Both periods cut to their first `days` days (null keeps them whole); a period never grows. */
export function truncate(periods: ComparePeriods, days: number | null): ComparePeriods {
  if (days == null) return periods;
  const cut = (from: string, to: string) => {
    const end = shiftDays(from, days - 1);
    return end < to ? end : to;
  };
  return { ...periods, toA: cut(periods.fromA, periods.toA), toB: cut(periods.fromB, periods.toB) };
}

/** Days of the shorter period, to cut a custom pair to the same length. */
export function commonDays(periods: ComparePeriods): number {
  return Math.min(daysBetween(periods.fromA, periods.toA), daysBetween(periods.fromB, periods.toB)) + 1;
}

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The latest complete month of a savings range, for the 50/30/20 card and the destinations. */
export function lastCompleteMonth(months: Schemas['MonthSavings'][]): Schemas['MonthSavings'] | undefined {
  return [...months].reverse().find((month) => month.complete);
}

/** First and last day of a "2026-09" month. */
export function monthPeriod(month: string): { from: string; to: string } {
  const start = dayjs(`${month}-01`);
  return { from: isoDate(start), to: isoDate(start.endOf('month')) };
}

/** "2026-10" moved by a number of months. */
export function shiftMonth(month: string, by: number): string {
  return dayjs(`${month}-01`).add(by, 'month').format('YYYY-MM');
}
