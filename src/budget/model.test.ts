import dayjs from 'dayjs';
import { budgetRowOf } from '../test/fixtures';
import { flatEnvelopes, monthProgress, parseMonth, spentShare } from './model';

describe('parseMonth', () => {
  it('reads YYYY-MM and falls back to the current month', () => {
    expect(parseMonth('2026-09').format('YYYY-MM-DD')).toBe('2026-09-01');
    expect(parseMonth('oops', dayjs('2026-10-15')).format('YYYY-MM-DD')).toBe('2026-10-01');
  });
});

describe('flatEnvelopes', () => {
  const food = budgetRowOf({
    categoryId: 1,
    name: 'Їжа',
    children: [
      budgetRowOf({
        categoryId: 2,
        name: 'Продукти',
        parentId: 1,
        ownAssigned: 9000,
        ownActivity: -4950,
        ownAvailable: 4050,
      }),
      budgetRowOf({
        categoryId: 3,
        name: 'Кафе',
        parentId: 1,
        ownAssigned: 2000,
        ownActivity: -2340,
        ownAvailable: -340,
      }),
    ],
  });

  it('lists every own envelope for moving money', () => {
    expect(flatEnvelopes([food]).map((row) => [row.name, row.assigned])).toEqual([
      ['Їжа', 0],
      ['Продукти', 9000],
      ['Кафе', 2000],
    ]);
  });
});

describe('monthProgress', () => {
  it('is the share of the current month that has passed', () => {
    expect(monthProgress(dayjs('2026-10-01'), dayjs('2026-10-15'))).toBeCloseTo(15 / 31);
    expect(monthProgress(dayjs('2026-09-01'), dayjs('2026-10-15'))).toBeNull();
  });
});

describe('spentShare', () => {
  it('compares spending with the money the envelope had', () => {
    expect(spentShare({ activity: -4950, available: 4050 })).toBeCloseTo(0.55);
    expect(spentShare({ activity: -2340, available: -340 })).toBeCloseTo(1.17);
    expect(spentShare({ activity: 0, available: 0 })).toBe(0);
  });
});
