import { endDateForCount, nextDates, occurrenceDate, perMonth } from './schedule';

it('keeps the day of the month after short months, like the backend', () => {
  expect([0, 1, 2, 3].map((index) => occurrenceDate('2026-01-31', 'MONTHLY', 1, index))).toEqual([
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
  ]);
  expect(occurrenceDate('2026-10-05', 'WEEKLY', 2, 2)).toBe('2026-11-02');
  expect(occurrenceDate('2024-02-29', 'YEARLY', 1, 1)).toBe('2025-02-28');
});

it('lists the next dates up to the end', () => {
  const schedule = { startDate: '2026-10-24', frequency: 'MONTHLY' as const, interval: 1 };
  expect(nextDates(schedule, '2026-11-01', 3)).toEqual(['2026-11-24', '2026-12-24', '2027-01-24']);
  expect(nextDates({ ...schedule, endDate: '2026-12-24' }, '2026-11-01', 3)).toEqual([
    '2026-11-24',
    '2026-12-24',
  ]);
});

it('turns a number of payments into an end date and counts payments per month', () => {
  expect(endDateForCount('2026-10-24', 'MONTHLY', 1, 3)).toBe('2026-12-24');
  expect(perMonth({ frequency: 'YEARLY', interval: 1 })).toBeCloseTo(1 / 12);
  expect(perMonth({ frequency: 'MONTHLY', interval: 2 })).toBe(0.5);
});
