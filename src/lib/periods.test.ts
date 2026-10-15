import dayjs from 'dayjs';
import { isPreset, kyivToday, periodOf } from './periods';

const today = dayjs('2026-10-15');

describe('periodOf', () => {
  it('covers the whole current and previous month', () => {
    expect(periodOf('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodOf('prevMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('covers three months back and the year to date', () => {
    expect(periodOf('quarter', today)).toEqual({ from: '2026-07-16', to: '2026-10-15' });
    expect(periodOf('year', today)).toEqual({ from: '2026-01-01', to: '2026-10-15' });
    expect(periodOf('twelveMonths', today)).toEqual({ from: '2025-11-01', to: '2026-10-15' });
  });

  it('is unbounded for all time and keeps a custom range', () => {
    expect(periodOf('all', today)).toEqual({});
    expect(periodOf('custom', today, { from: '2026-05-01' })).toEqual({ from: '2026-05-01' });
  });
});

describe('isPreset', () => {
  it('accepts known presets only', () => {
    expect(isPreset('year')).toBe(true);
    expect(isPreset('foo')).toBe(false);
    expect(isPreset(null)).toBe(false);
  });
});

describe('kyivToday', () => {
  it('uses the Kyiv date, not the browser one', () => {
    // 22:30 UTC on 31 October is already 1 November in Kyiv (UTC+2 in winter).
    expect(kyivToday(new Date('2026-10-31T22:30:00Z')).format('YYYY-MM-DD')).toBe('2026-11-01');
  });
});
