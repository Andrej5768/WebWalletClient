import dayjs from 'dayjs';
import type { DividendEvent } from '../api';

export type DividendStatus = DividendEvent['status'];

export const STATUSES: DividendStatus[] = ['RECEIVED', 'EXPECTED', 'DECLARED', 'FORECAST'];

/** Mantine colors of the statuses: income green, warning amber, accent, and a lighter accent for the forecast. */
export const STATUS_COLORS: Record<DividendStatus, string> = {
  RECEIVED: 'green.6',
  EXPECTED: 'yellow.6',
  DECLARED: 'blue.7',
  FORECAST: 'blue.3',
};

/** The days of a month by weeks starting on Monday; days of the neighbouring months are null. */
export function monthWeeks(month: string): (string | null)[][] {
  const first = dayjs(`${month}-01`);
  const days = first.daysInMonth();
  // dayjs counts weeks from Sunday: Monday is 1, Sunday 0 → 6
  const offset = (first.day() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: days }, (_, index) => first.add(index, 'day').format('YYYY-MM-DD')),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** Events by their date. */
export function byDay(events: DividendEvent[]): Map<string, DividendEvent[]> {
  const days = new Map<string, DividendEvent[]>();
  for (const event of events) days.set(event.date, [...(days.get(event.date) ?? []), event]);
  return days;
}

/** Events of a month ("2026-11"). */
export function ofMonth(events: DividendEvent[], month: string): DividendEvent[] {
  return events.filter((event) => event.date.startsWith(month));
}

/** The payments still to come after today, nearest first. */
export function upcoming(events: DividendEvent[], today: string, count: number): DividendEvent[] {
  return events
    .filter((event) => event.status !== 'RECEIVED' && event.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count);
}

/** The months from the month on, `count` of them ("2026-11"). */
export function monthsFrom(month: string, count: number): string[] {
  const first = dayjs(`${month}-01`);
  return Array.from({ length: count }, (_, index) => first.add(index, 'month').format('YYYY-MM'));
}

/** Received payments after tax per month, in the currency of the calendar. */
export function receivedByMonth(
  events: DividendEvent[],
  months: string[],
): { month: string; amount: number }[] {
  return months.map((month) => ({
    month,
    amount: ofMonth(events, month)
      .filter((event) => event.status === 'RECEIVED')
      .reduce((sum, event) => sum + event.netInTarget, 0),
  }));
}
