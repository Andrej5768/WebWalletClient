import type dayjs from 'dayjs';
import type { Schemas } from '../../api/client';
import { isoDate } from '../../lib/periods';

export type HistoryPoint = Schemas['HistoryPoint'];

export const RANGES = ['3m', '6m', '1y', 'all'] as const;
export type Range = (typeof RANGES)[number];

/** The first day of the range, undefined for all the history. */
export function rangeFrom(range: Range, today: dayjs.Dayjs): string | undefined {
  switch (range) {
    case '3m':
      return isoDate(today.subtract(3, 'month'));
    case '6m':
      return isoDate(today.subtract(6, 'month'));
    case '1y':
      return isoDate(today.subtract(1, 'year'));
    case 'all':
      return undefined;
  }
}

export interface Result {
  /** What was earned over the range: the change of the value without the money brought in. */
  profit: number;
  /** The profit to what was at stake: the value at the start plus the money brought in since. */
  share: number | null;
}

/**
 * The profit of the portfolio over the points: the last value minus the first, without the deposits made between
 * them. `pick` chooses the series (the portfolio or the benchmark).
 */
export function result(points: HistoryPoint[], pick: (point: HistoryPoint) => number | null): Result | null {
  const valued = points.filter((point) => pick(point) != null);
  const first = valued[0];
  const last = valued.at(-1);
  if (!first || !last) return null;
  const deposits = last.deposited - first.deposited;
  const profit = pick(last)! - pick(first)! - deposits;
  const stake = pick(first)! + deposits;
  return { profit, share: stake > 0 ? profit / stake : null };
}
