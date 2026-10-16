import { compound, fire, fym, loadStored, store, trackPosition } from './fire';

it('finds the FIRE number and the years to it', () => {
  const plain = fire({
    expenses: 40000,
    withdrawalRate: 0.04,
    realReturn: 0,
    yearlySavings: 100000,
    capital: 0,
  });
  expect(plain.target).toBe(1_000_000);
  expect(plain.years).toBe(10);
  // At least 20 years, and 3 past FIRE
  expect(plain.path).toHaveLength(21);

  const growing = fire({
    expenses: 40000,
    withdrawalRate: 0.04,
    realReturn: 0.1,
    yearlySavings: 100000,
    capital: 0,
  });
  expect(growing.years).toBe(8);
  expect(growing.path[1]).toBeCloseTo(100000);
  expect(growing.path[2]).toBeCloseTo(210000);
  expect(growing.levels.lean).toBeCloseTo(700000);
  expect(growing.levels.fat).toBeCloseTo(1_500_000);
  expect(growing.levels.coast).toBeCloseTo(1_000_000 / Math.pow(1.1, 20));

  expect(
    fire({ expenses: 40000, withdrawalRate: 0.04, realReturn: 0, yearlySavings: 0, capital: 2_000_000 })
      .years,
  ).toBe(0);
  const never = fire({
    expenses: 40000,
    withdrawalRate: 0.04,
    realReturn: 0,
    yearlySavings: 100,
    capital: 0,
  });
  expect(never.years).toBeNull();
  expect(never.path).toHaveLength(64);
});

it('counts the months the liquid money lasts', () => {
  expect(fym(60000, 10000, 12, 5000)).toEqual({ months: 6, need: 120000, left: 60000, eta: 12 });
  expect(fym(150000, 10000, 12, 0)).toEqual({ months: 15, need: 120000, left: 0, eta: 0 });
  expect(fym(60000, 10000, 12, 0).eta).toBeNull();
  expect(fym(60000, 0, 12, 0).months).toBeNull();
});

it('places the months evenly between the milestones', () => {
  expect(trackPosition(0.5)).toBe(0);
  expect(trackPosition(3)).toBe(0.25);
  expect(trackPosition(6)).toBe(0.5);
  expect(trackPosition(9)).toBe(0.625);
  expect(trackPosition(30)).toBe(1);
});

it('compounds monthly, quarterly or yearly with growing contributions', () => {
  const base = { initial: 1000, monthly: 0, rate: 0.12, years: 1, growth: 0, inflation: 0, real: false };
  expect(compound({ ...base, capitalization: 'MONTHLY' }).balance).toBeCloseTo(1000 * Math.pow(1.01, 12));
  expect(compound({ ...base, capitalization: 'QUARTERLY' }).balance).toBeCloseTo(1000 * Math.pow(1.03, 4));
  expect(compound({ ...base, capitalization: 'YEARLY' }).balance).toBeCloseTo(1120);

  const growing = compound({
    initial: 0,
    monthly: 100,
    rate: 0,
    years: 2,
    capitalization: 'MONTHLY',
    growth: 0.1,
    inflation: 0.1,
    real: false,
  });
  expect(growing.rows.map((row) => row.balance)).toEqual([1200, 2520]);
  expect(growing.contributed).toBe(2520);
  expect(growing.interest).toBe(0);
  expect(growing.realBalance).toBeCloseTo(2520 / 1.21);

  const real = compound({
    initial: 0,
    monthly: 100,
    rate: 0,
    years: 1,
    capitalization: 'MONTHLY',
    growth: 0,
    inflation: 0.1,
    real: true,
  });
  expect(real.rows[0]!.balance).toBeCloseTo(1200 / 1.1);
});

it('keeps values in the browser and survives broken storage', () => {
  store('ww-test', { a: 1 });
  expect(loadStored('ww-test', { a: 0, b: 2 })).toEqual({ a: 1, b: 2 });
  localStorage.setItem('ww-test', '{broken');
  expect(loadStored('ww-test', { a: 0 })).toEqual({ a: 0 });
});
