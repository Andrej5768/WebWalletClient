import dayjs from 'dayjs';

export type Preset = 'month' | 'prevMonth' | 'quarter' | 'year' | 'all' | 'custom';
export const presets: Preset[] = ['month', 'prevMonth', 'quarter', 'year', 'all', 'custom'];

export interface Period {
  /** ISO dates, inclusive; undefined means unbounded. */
  from?: string;
  to?: string;
}

const iso = (date: dayjs.Dayjs) => date.format('YYYY-MM-DD');

/** Date range of a preset relative to `today`; "custom" keeps the given range. */
export function periodOf(preset: Preset, today: Date, custom: Period = {}): Period {
  const now = dayjs(today);
  switch (preset) {
    case 'month':
      return { from: iso(now.startOf('month')), to: iso(now.endOf('month')) };
    case 'prevMonth': {
      const previous = now.subtract(1, 'month');
      return { from: iso(previous.startOf('month')), to: iso(previous.endOf('month')) };
    }
    case 'quarter':
      return { from: iso(now.subtract(3, 'month').add(1, 'day')), to: iso(now) };
    case 'year':
      return { from: iso(now.startOf('year')), to: iso(now) };
    case 'all':
      return {};
    case 'custom':
      return custom;
  }
}
