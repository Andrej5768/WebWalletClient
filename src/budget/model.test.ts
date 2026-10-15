import dayjs from 'dayjs';
import { groupEnvelopes, monthProgress, parseMonth, spentShare, type Envelope } from './model';

describe('parseMonth', () => {
  it('reads YYYY-MM and falls back to the current month', () => {
    expect(parseMonth('2026-09').format('YYYY-MM-DD')).toBe('2026-09-01');
    expect(parseMonth('oops').isSame(dayjs(), 'month')).toBe(true);
  });
});

describe('groupEnvelopes', () => {
  it('sums the head and its children, with spending as a positive number', () => {
    const rows: Envelope[] = [
      {
        categoryId: 1,
        name: 'Їжа',
        assigned: 0,
        activity: 0,
        available: 0,
        children: [
          { categoryId: 2, name: 'Продукти', assigned: 9000, activity: -4950, available: 4050 },
          { categoryId: 3, name: 'Кафе', assigned: 2000, activity: -2340, available: -340 },
        ],
      },
    ];
    expect(groupEnvelopes(rows)[0]).toMatchObject({ assigned: 11000, spent: 7290, available: 3710 });
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
