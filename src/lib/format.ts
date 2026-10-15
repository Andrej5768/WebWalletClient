import dayjs from 'dayjs';
import { locale } from '../i18n';

/** "жовт. 26" / "Oct 26" for a "2026-10" month. */
export function formatMonthShort(month?: string | null): string {
  return dayjs(`${month}-01`).toDate().toLocaleDateString(locale(), { month: 'short', year: '2-digit' });
}

/** "жовтень 2026" / "October 2026". */
export function formatMonthLong(date: dayjs.Dayjs): string {
  return date.toDate().toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
}

/** "15.10.2026". */
export function formatDate(date?: string | null): string {
  return date ? dayjs(date).format('DD.MM.YYYY') : '';
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
