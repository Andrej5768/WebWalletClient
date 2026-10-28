import dayjs from 'dayjs';
import type { Schemas } from '../api/client';
import { kyivToday } from '../lib/periods';

export type MonthBudget = Schemas['MonthResponse'];
export type BudgetRow = Schemas['CategoryRow'];

/** The own envelope of one category: what is assigned to it and spent from it, without its subcategories. */
export interface Envelope {
  categoryId: number;
  name: string;
  assigned: number;
  activity: number;
  available: number;
}

export const monthKey = (date: dayjs.Dayjs) => date.format('YYYY-MM');

/** "2026-10" from the URL, or the current month when it is missing or malformed. */
export function parseMonth(value: string | null, today: dayjs.Dayjs = kyivToday()): dayjs.Dayjs {
  const parsed = value && /^\d{4}-\d{2}$/.test(value) ? dayjs(`${value}-01`) : null;
  return parsed?.isValid() ? parsed : today.startOf('month');
}

function ownEnvelope(row: BudgetRow): Envelope {
  return {
    categoryId: row.categoryId,
    name: row.name,
    assigned: row.ownAssigned,
    activity: row.ownActivity,
    available: row.ownAvailable,
  };
}

/** Every own envelope in display order, groups included. */
export function flatEnvelopes(rows: BudgetRow[]): Envelope[] {
  return rows.flatMap((row) => [ownEnvelope(row), ...row.children.map(ownEnvelope)]);
}

/** Share of the month that has passed, 0..1, for the "today" marker; null for other months. */
export function monthProgress(month: dayjs.Dayjs, today: dayjs.Dayjs = kyivToday()): number | null {
  if (!month.isSame(today, 'month')) return null;
  return today.date() / today.daysInMonth();
}

/** Spent share of the money available at the start of the month (assigned plus rollover). */
export function spentShare(envelope: Pick<Envelope, 'activity' | 'available'>): number {
  const spent = -envelope.activity;
  const budget = envelope.available + spent;
  if (budget <= 0) return spent > 0 ? 1 : 0;
  return spent / budget;
}
