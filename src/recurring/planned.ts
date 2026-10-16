import type { Occurrence } from './api';

/** A planned payment as the feed shows it; a frequent series stands for its later dates too. */
export interface PlannedRow {
  occurrence: Occurrence;
  /** How many dates of the series up to the end of the group this row stands for (1 for a single date). */
  repeats: number;
  /** The last of those dates. */
  until: string;
}

/** Series with more upcoming dates than this in the group show only the nearest one. */
const MAX_DATES_OF_SERIES = 2;

/**
 * The rows of the planned group: overdue dates each on their own, and of a series with more than two upcoming dates
 * (weekly pocket money, a daily subscription) only the nearest one, which says how many follow. Upcoming dates of
 * other series are listed one by one.
 */
export function plannedRows(occurrences: Occurrence[]): PlannedRow[] {
  const upcoming = new Map<number, Occurrence[]>();
  for (const occurrence of occurrences) {
    if (!occurrence.overdue) {
      upcoming.set(occurrence.recurringId, [...(upcoming.get(occurrence.recurringId) ?? []), occurrence]);
    }
  }
  const rows: PlannedRow[] = [];
  for (const occurrence of occurrences) {
    const series = upcoming.get(occurrence.recurringId) ?? [];
    if (occurrence.overdue || series.length <= MAX_DATES_OF_SERIES) {
      rows.push({ occurrence, repeats: 1, until: occurrence.date });
    } else if (series[0] === occurrence) {
      rows.push({ occurrence, repeats: series.length, until: series[series.length - 1]!.date });
    }
  }
  return rows;
}

/** Rows by day, the latest day first like the feed. */
export function byDayDescending(rows: PlannedRow[]): { date: string; rows: PlannedRow[] }[] {
  const days = new Map<string, PlannedRow[]>();
  for (const row of [...rows].sort((a, b) => b.occurrence.date.localeCompare(a.occurrence.date))) {
    days.set(row.occurrence.date, [...(days.get(row.occurrence.date) ?? []), row]);
  }
  return [...days].map(([date, dayRows]) => ({ date, rows: dayRows }));
}
