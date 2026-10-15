import dayjs from 'dayjs';
import type { Schemas } from '../api/client';

export type MonthBudget = Schemas['MonthResponse'];
export type Envelope = Schemas['CategoryRow'];

export const monthKey = (date: dayjs.Dayjs) => date.format('YYYY-MM');

/** "2026-10" from the URL, or the current month when it is missing or malformed. */
export function parseMonth(value: string | null): dayjs.Dayjs {
  const parsed = value && /^\d{4}-\d{2}$/.test(value) ? dayjs(`${value}-01`) : null;
  return parsed?.isValid() ? parsed : dayjs().startOf('month');
}

export interface EnvelopeGroup {
  /** The top-level category; it is an envelope of its own as well. */
  head: Envelope;
  envelopes: Envelope[];
  assigned: number;
  spent: number;
  available: number;
}

/** Groups the top-level rows with their children and sums them. */
export function groupEnvelopes(rows: Envelope[]): EnvelopeGroup[] {
  return rows.map((head) => {
    const envelopes = [head, ...(head.children ?? [])];
    const sum = (pick: (row: Envelope) => number | undefined) =>
      envelopes.reduce((total, row) => total + (pick(row) ?? 0), 0);
    return {
      head,
      envelopes: head.children ?? [],
      assigned: sum((row) => row.assigned),
      spent: -sum((row) => row.activity),
      available: sum((row) => row.available),
    };
  });
}

/** Every envelope in display order, heads included. */
export function flatEnvelopes(rows: Envelope[]): Envelope[] {
  return rows.flatMap((row) => [row, ...(row.children ?? [])]);
}

/** Share of the month that has passed, 0..1, for the "today" marker; null for other months. */
export function monthProgress(month: dayjs.Dayjs, today = dayjs()): number | null {
  if (!month.isSame(today, 'month')) return null;
  return today.date() / today.daysInMonth();
}

/** Spent share of the money available at the start of the month (assigned plus rollover). */
export function spentShare(envelope: Envelope): number {
  const spent = -(envelope.activity ?? 0);
  const budget = (envelope.available ?? 0) + spent;
  if (budget <= 0) return spent > 0 ? 1 : 0;
  return spent / budget;
}
