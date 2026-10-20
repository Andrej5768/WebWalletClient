import type { FopQuarter, IncomeReason, TaxRates } from './api';
import { saveBlob } from '../lib/download';

export const TAB_KEYS = ['fop', 'investments'] as const;
export type TaxTab = (typeof TAB_KEYS)[number];

/** The years to choose from: this one and three before it. */
export function taxYears(current: number): number[] {
  return [current - 3, current - 2, current - 1, current];
}

export type QuarterState = 'paid' | 'due' | 'running';

/** Paid when marked so; due once the quarter is over; running before. */
export function quarterState(quarter: FopQuarter, year: number, today: string): QuarterState {
  if (quarter.paid) return 'paid';
  const end = new Date(Date.UTC(year, quarter.quarter * 3, 0)).toISOString().slice(0, 10);
  return today > end ? 'due' : 'running';
}

/** The quarter shown first: the current one in the current year, else the last one with income. */
export function initialQuarter(quarters: FopQuarter[], year: number, today: string): number {
  if (today.startsWith(String(year))) return Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const withIncome = quarters.filter((quarter) => quarter.income > 0);
  return withIncome.length ? withIncome[withIncome.length - 1]!.quarter : 4;
}

/**
 * The mark that turns an income on or off: the rules (an FOP account, a chosen category) count it by themselves, so
 * turning such an income off takes it out (false) and on again forgets the mark (null); an income added by hand is
 * added (true) or forgotten.
 */
export function markFor(include: boolean, ruleReason: IncomeReason | null | undefined): boolean | null {
  if (ruleReason) return include ? null : false;
  return include ? true : null;
}

/** The single tax and military levy as the group pays them: shares of income for group 3, amounts a month else. */
export function fopRateText(
  rates: TaxRates,
  percent: (value: number) => string,
  money: (value: number) => string,
) {
  return rates.fopGroup === 3
    ? { single: percent(rates.singleTaxRate), military: percent(rates.fopMilitaryRate) }
    : { single: money(rates.singleTaxMonthly), military: money(rates.fopMilitaryMonthly) };
}

/** The social contribution a month, as the backend counts it. */
export function esvMonthly(rates: TaxRates): number {
  return rates.esvEnabled ? Math.round(rates.minWage * rates.esvRate) / 100 : 0;
}

/** A CSV file: values with separators or quotes are quoted; Excel opens it as UTF-8 thanks to the BOM. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value == null ? '' : String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\n');
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  saveBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), name);
}
