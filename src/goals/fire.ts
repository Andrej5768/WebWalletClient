/** Years the FIRE projection looks ahead at most. */
const MAX_YEARS = 60;

/** Coast FIRE: the capital that reaches the FIRE number in this many years without contributions. */
export const COAST_YEARS = 20;

export interface FireInput {
  /** Spending of a year. */
  expenses: number;
  /** Safe withdrawal rate, e.g. 0.04. */
  withdrawalRate: number;
  /** Expected yearly return after inflation, e.g. 0.05. */
  realReturn: number;
  /** Saved per year, added at the end of each year. */
  yearlySavings: number;
  /** Capital today. */
  capital: number;
}

export interface FireResult {
  /** The capital whose withdrawals cover the expenses. */
  target: number;
  /** Whole years until the capital reaches the target; 0 when it already has; null beyond 60 years. */
  years: number | null;
  /** Capital at the end of each year from now (index 0 = today), at least 20 years and 3 past FIRE. */
  path: number[];
  levels: { lean: number; regular: number; fat: number; coast: number; barista: number };
}

/** FIRE number and the years to it: yearly compounding with the savings added once a year. */
export function fire(input: FireInput): FireResult {
  const target = input.withdrawalRate > 0 ? input.expenses / input.withdrawalRate : Infinity;
  const path = [input.capital];
  let capital = input.capital;
  let years: number | null = capital >= target ? 0 : null;
  for (let year = 1; years === null && year <= MAX_YEARS; year++) {
    capital = capital * (1 + input.realReturn) + input.yearlySavings;
    path.push(capital);
    if (capital >= target) years = year;
  }
  const horizon = Math.max(20, (years ?? MAX_YEARS) + 3);
  while (path.length <= horizon) {
    capital = capital * (1 + input.realReturn) + input.yearlySavings;
    path.push(capital);
  }
  return {
    target,
    years,
    path: path.slice(0, horizon + 1),
    levels: {
      lean: target * 0.7,
      regular: target,
      fat: target * 1.5,
      coast: target / Math.pow(1 + input.realReturn, COAST_YEARS),
      // Half of the expenses come from the capital, the other half from a part-time job
      barista: target / 2,
    },
  };
}

export interface FymResult {
  /** Months the liquid money lasts at the monthly expenses; null without expenses. */
  months: number | null;
  /** What the target months need. */
  need: number;
  /** What is still missing for the target, 0 once reached. */
  left: number;
  /** Months of savings that bring the rest; null when nothing is saved. */
  eta: number | null;
}

/** "Freedom money": how long the liquid money lasts without income. */
export function fym(
  liquid: number,
  monthlyExpenses: number,
  targetMonths: number,
  monthlySavings: number,
): FymResult {
  const need = targetMonths * monthlyExpenses;
  const left = Math.max(0, need - liquid);
  return {
    months: monthlyExpenses > 0 ? liquid / monthlyExpenses : null,
    need,
    left,
    eta: left === 0 ? 0 : monthlySavings > 0 ? left / monthlySavings : null,
  };
}

/** Milestones of the FYM track, in months. */
export const FYM_MILESTONES = [1, 3, 6, 12, 24];

/** Where the months sit on the track of the milestones, 0..1, evenly spaced between them. */
export function trackPosition(months: number): number {
  if (months <= 0) return 0;
  if (months <= FYM_MILESTONES[0]!) return 0;
  for (let i = 1; i < FYM_MILESTONES.length; i++) {
    const high = FYM_MILESTONES[i]!;
    const low = FYM_MILESTONES[i - 1]!;
    if (months <= high) return (i - 1 + (months - low) / (high - low)) / (FYM_MILESTONES.length - 1);
  }
  return 1;
}

export type Capitalization = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface CompoundInput {
  initial: number;
  /** Paid at the start of every month. */
  monthly: number;
  /** Yearly rate, e.g. 0.12. */
  rate: number;
  years: number;
  capitalization: Capitalization;
  /** Yearly growth of the monthly contribution, e.g. 0.05. */
  growth: number;
  /** Yearly inflation, e.g. 0.08, for the values in today's prices. */
  inflation: number;
  /** Show the values in today's prices. */
  real: boolean;
}

export interface CompoundYear {
  year: number;
  balance: number;
  contributed: number;
}

export interface CompoundResult {
  rows: CompoundYear[];
  balance: number;
  contributed: number;
  interest: number;
  /** The final balance in today's prices. */
  realBalance: number;
}

/**
 * Compound interest month by month: the contribution comes at the start of a month, interest is added at the end
 * of each capitalization period, and the contribution grows once a year.
 */
export function compound(input: CompoundInput): CompoundResult {
  let balance = input.initial;
  let contributed = input.initial;
  let contribution = input.monthly;
  const rows: CompoundYear[] = [];
  const months = Math.max(0, Math.round(input.years)) * 12;
  for (let month = 1; month <= months; month++) {
    balance += contribution;
    contributed += contribution;
    if (input.capitalization === 'MONTHLY') balance *= 1 + input.rate / 12;
    else if (input.capitalization === 'QUARTERLY' && month % 3 === 0) balance *= 1 + input.rate / 4;
    else if (input.capitalization === 'YEARLY' && month % 12 === 0) balance *= 1 + input.rate;
    if (month % 12 === 0) {
      const year = month / 12;
      const deflator = input.real ? Math.pow(1 + input.inflation, year) : 1;
      rows.push({ year, balance: balance / deflator, contributed: contributed / deflator });
      contribution *= 1 + input.growth;
    }
  }
  const last = rows[rows.length - 1];
  const years = months / 12;
  return {
    rows,
    balance: last?.balance ?? input.initial,
    contributed: last?.contributed ?? input.initial,
    interest: (last?.balance ?? input.initial) - (last?.contributed ?? input.initial),
    realBalance: balance / Math.pow(1 + input.inflation, years),
  };
}
