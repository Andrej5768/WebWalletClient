import dayjs from 'dayjs';
import { locale } from '../i18n';
import { kyivToday } from './periods';

/** "жовт. 26" / "Oct 26" for a "2026-10" month. */
export function formatMonthShort(month?: string | null): string {
  return dayjs(`${month}-01`).toDate().toLocaleDateString(locale(), { month: 'short', year: '2-digit' });
}

/** "жовтень 2026" / "October 2026". */
export function formatMonthLong(date: dayjs.Dayjs): string {
  return date.toDate().toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
}

/**
 * "Жовтень 2026 р." / "October 2026": a month as a title. Only the first letter of the text is capitalized (CSS
 * `text-transform: capitalize` would also turn "р." into "Р.").
 */
export function formatMonthTitle(date: dayjs.Dayjs): string {
  return capitalize(formatMonthLong(date));
}

/** The text with its first letter in upper case. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "15.10.2026". */
export function formatDate(date?: string | null): string {
  return date ? dayjs(date).format('DD.MM.YYYY') : '';
}

/** "20 жовт." / "20 Oct", with the year when it is not the current one: "17 серп. 2027 р.". */
export function formatDayShort(date?: string | null): string {
  if (!date) return '';
  const day = dayjs(date);
  return day.toDate().toLocaleDateString(locale(), {
    day: 'numeric',
    month: 'short',
    ...(day.year() === kyivToday().year() ? {} : { year: 'numeric' }),
  });
}

/** "26 жовт. 2026 р." / "26 Oct 2026": a date in tables and lists, always with the year. */
export function formatDay(date?: string | null): string {
  if (!date) return '';
  return dayjs(date)
    .toDate()
    .toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "15 жовт., 14:45". */
export function formatDateTime(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString(locale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A share 0..1 as "22,5%" with one decimal (whole numbers stay whole). */
export function formatPercent(share?: number | null): string {
  if (share == null) return '—';
  return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1 }).format(share);
}
