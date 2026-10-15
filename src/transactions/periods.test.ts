import { periodOf } from './periods';

const today = new Date(2026, 9, 15);

describe('periodOf', () => {
  it('covers the whole current and previous month', () => {
    expect(periodOf('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodOf('prevMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('covers three months back and the year to date', () => {
    expect(periodOf('quarter', today)).toEqual({ from: '2026-07-16', to: '2026-10-15' });
    expect(periodOf('year', today)).toEqual({ from: '2026-01-01', to: '2026-10-15' });
  });

  it('is unbounded for all time and keeps a custom range', () => {
    expect(periodOf('all', today)).toEqual({});
    expect(periodOf('custom', today, { from: '2026-05-01' })).toEqual({ from: '2026-05-01' });
  });
});
