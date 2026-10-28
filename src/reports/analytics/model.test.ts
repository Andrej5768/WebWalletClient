import dayjs from 'dayjs';
import { commonDays, comparePeriods, lastCompleteMonth, monthPeriod, shiftMonth, truncate } from './model';

const today = dayjs('2026-10-15');

it('compares the current month with the previous one up to the same day', () => {
  expect(comparePeriods('mom', today, true)).toEqual({
    fromA: '2026-10-01',
    toA: '2026-10-15',
    fromB: '2026-09-01',
    toB: '2026-09-15',
  });
  expect(comparePeriods('yoy', today, false)).toEqual({
    fromA: '2026-10-01',
    toA: '2026-10-31',
    fromB: '2025-10-01',
    toB: '2025-10-31',
  });
});

it('never makes a period longer when cutting it', () => {
  const periods = { fromA: '2026-03-01', toA: '2026-03-31', fromB: '2026-02-01', toB: '2026-02-28' };
  expect(truncate(periods, 30)).toEqual({ ...periods, toA: '2026-03-30' });
  expect(commonDays(periods)).toBe(28);
});

it('works with months', () => {
  expect(monthPeriod('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  const months = [
    { month: '2026-09', complete: true },
    { month: '2026-10', complete: false },
  ] as Parameters<typeof lastCompleteMonth>[0];
  expect(lastCompleteMonth(months)?.month).toBe('2026-09');
});
