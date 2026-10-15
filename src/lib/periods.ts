import dayjs from 'dayjs';

export type Preset = 'month' | 'prevMonth' | 'quarter' | 'year' | 'twelveMonths' | 'all' | 'custom';
const PRESETS: readonly Preset[] = ['month', 'prevMonth', 'quarter', 'year', 'twelveMonths', 'all', 'custom'];

export function isPreset(value: string | null | undefined): value is Preset {
  return !!value && (PRESETS as readonly string[]).includes(value);
}

export interface Period {
  /** ISO dates, inclusive; undefined means unbounded. */
  from?: string;
  to?: string;
}

/** Today's date in Kyiv, where the money lives, whatever the browser's time zone is. */
export function kyivToday(now: Date = new Date()): dayjs.Dayjs {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return dayjs(date);
}

export const isoDate = (date: dayjs.Dayjs) => date.format('YYYY-MM-DD');

/** Date range of a preset relative to `today`; "custom" keeps the given range. */
export function periodOf(preset: Preset, today: dayjs.Dayjs = kyivToday(), custom: Period = {}): Period {
  switch (preset) {
    case 'month':
      return { from: isoDate(today.startOf('month')), to: isoDate(today.endOf('month')) };
    case 'prevMonth': {
      const previous = today.subtract(1, 'month');
      return { from: isoDate(previous.startOf('month')), to: isoDate(previous.endOf('month')) };
    }
    case 'quarter':
      return { from: isoDate(today.subtract(3, 'month').add(1, 'day')), to: isoDate(today) };
    case 'year':
      return { from: isoDate(today.startOf('year')), to: isoDate(today) };
    case 'twelveMonths':
      return { from: isoDate(today.subtract(11, 'month').startOf('month')), to: isoDate(today) };
    case 'all':
      return {};
    case 'custom':
      return custom;
  }
}
