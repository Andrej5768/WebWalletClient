import { useQuery } from '@tanstack/react-query';
import type dayjs from 'dayjs';
import { api } from '../api/client';
import { unwrap } from '../api/http';
import { queryKeys } from '../api/queries';
import type { Schemas } from '../api/client';
import { kyivToday } from '../lib/periods';
import { monthKey } from './model';

export type BudgetPlan = Schemas['BudgetPlanResponse'];
export type PlanRow = Schemas['BudgetPlanRow'];
export type PlanCell = Schemas['BudgetPlanCell'];
export type PlanTotals = Schemas['BudgetPlanTotals'];

/** Months shown before and after the current one. */
export const MONTHS_AROUND = 12;

/** The range of the table: twelve months back, the current one and twelve ahead. */
export function planRange(today: dayjs.Dayjs = kyivToday()) {
  const current = today.startOf('month');
  return {
    from: monthKey(current.subtract(MONTHS_AROUND, 'month')),
    to: monthKey(current.add(MONTHS_AROUND, 'month')),
    current: monthKey(current),
  };
}

export function usePlan(from: string, to: string) {
  return useQuery({
    queryKey: [...queryKeys.budget, 'plan', from, to] as const,
    queryFn: () => unwrap(api.GET('/api/v1/budget', { params: { query: { from, to } } })),
  });
}

/** Sets the plans of several categories of a month at once: all of them or none. */
export const assignMany = (month: string, plans: { categoryId: number; assigned: number }[]) =>
  unwrap(api.PUT('/api/v1/budget/{month}/categories', { params: { path: { month } }, body: { plans } }));

/** One line of the table: a category whose plan can be typed in, or a group that sums its lines. */
export interface Line {
  key: string;
  categoryId: number;
  name: string;
  kind: 'income' | 'expense';
  /** A heading of a group: its values are the sums, its plan is not edited here. */
  group: boolean;
  /** Under a group heading. */
  nested: boolean;
  carryOver: boolean;
  average: number;
  /** Per month, in the order of the plan's months. */
  cells: { plan: number; actual: number }[];
}

/**
 * The lines of one section. A category without subcategories is one line. A category with subcategories is a heading
 * with its totals, followed by its own line when it has its own plan or actual values, and by its subcategories.
 */
export function linesOf(rows: PlanRow[], kind: Line['kind']): Line[] {
  const lines: Line[] = [];
  const own = (row: PlanRow, nested: boolean): Line => ({
    key: `${row.categoryId}`,
    categoryId: row.categoryId,
    name: row.name,
    kind,
    group: false,
    nested,
    carryOver: row.carryOver,
    average: row.ownAverage,
    cells: row.months.map((cell) => ({ plan: cell.ownPlan, actual: cell.ownActual })),
  });
  for (const row of rows) {
    if (row.children.length === 0) {
      lines.push(own(row, false));
      continue;
    }
    lines.push({
      key: `group-${row.categoryId}`,
      categoryId: row.categoryId,
      name: row.name,
      kind,
      group: true,
      nested: false,
      carryOver: false,
      average: row.average,
      cells: row.months.map((cell) => ({ plan: cell.plan, actual: cell.actual })),
    });
    const hasOwn =
      row.ownAverage !== 0 || row.months.some((cell) => cell.ownPlan !== 0 || cell.ownActual !== 0);
    if (hasOwn) lines.push(own(row, true));
    for (const child of row.children) lines.push(own(child, true));
  }
  return lines;
}

export type MonthTense = 'past' | 'current' | 'future';

export function tenseOf(month: string, current: string): MonthTense {
  return month < current ? 'past' : month === current ? 'current' : 'future';
}

/**
 * Whether the actual value misses the plan the bad way: spending above it, or income below it once the month is
 * over (during the month the income may still come).
 */
export function missesPlan(kind: Line['kind'], plan: number, actual: number, tense: MonthTense): boolean {
  if (tense === 'future') return false;
  if (kind === 'expense') return actual > plan;
  return tense === 'past' && plan > 0 && actual < plan;
}
