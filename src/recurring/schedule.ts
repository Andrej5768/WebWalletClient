import type { TFunction } from 'i18next';
import dayjs from 'dayjs';
import { locale } from '../i18n';
import type { Frequency, Recurring } from './api';

const UNITS = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' } as const;

/** Payments per month of each unit, to compare weekly or yearly payments with monthly ones. */
const PER_MONTH = { DAILY: 365.25 / 12, WEEKLY: 365.25 / 12 / 7, MONTHLY: 1, YEARLY: 1 / 12 } as const;

/**
 * The scheduled date with the index, counted from the start like the backend does, so that a
 * payment on the 31st falls on the last day of shorter months and comes back after them.
 */
export function occurrenceDate(start: string, frequency: Frequency, interval: number, index: number): string {
  return dayjs(start)
    .add(index * interval, UNITS[frequency])
    .format('YYYY-MM-DD');
}

/** The next scheduled dates from the day on (inclusive), at most `count`, none past the end. */
export function nextDates(
  schedule: { startDate: string; frequency: Frequency; interval: number; endDate?: string | null },
  from: string,
  count: number,
): string[] {
  const dates: string[] = [];
  for (let index = 0; dates.length < count && index < 5000; index++) {
    const date = occurrenceDate(schedule.startDate, schedule.frequency, schedule.interval, index);
    if (schedule.endDate && date > schedule.endDate) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}

/** The date of the last of `count` payments, for an end given as a number of payments. */
export function endDateForCount(
  start: string,
  frequency: Frequency,
  interval: number,
  count: number,
): string {
  return occurrenceDate(start, frequency, interval, Math.max(0, count - 1));
}

/**
 * The first date on or after `from` that falls on the weekday (0 = Sunday, as in dayjs) of a weekly
 * schedule or on the day and month (1-based) of a yearly one; the 29th of February falls on the 28th
 * in other years, as the backend does. Other schedules start on `from`.
 */
export function alignedStart(
  from: string,
  frequency: Frequency,
  anchor: { weekday: number; month: number; day: number },
): string {
  const start = dayjs(from);
  if (frequency === 'WEEKLY') {
    return start.add((anchor.weekday - start.day() + 7) % 7, 'day').format('YYYY-MM-DD');
  }
  if (frequency === 'YEARLY') {
    const inYear = (year: number) => {
      const month = start
        .year(year)
        .month(anchor.month - 1)
        .date(1);
      return month.date(Math.min(anchor.day, month.daysInMonth()));
    };
    const date = inYear(start.year());
    return (date.isBefore(start, 'day') ? inYear(start.year() + 1) : date).format('YYYY-MM-DD');
  }
  return from;
}

/** How many payments happen in a month on average. */
export function perMonth(recurring: Pick<Recurring, 'frequency' | 'interval'>): number {
  return PER_MONTH[recurring.frequency] / recurring.interval;
}

/** "щомісяця 24-го", "кожні 2 тижні, пн", "щороку 1 січ.", "щодня". */
export function scheduleText(
  schedule: { startDate: string; frequency: Frequency; interval: number },
  t: TFunction,
): string {
  const start = dayjs(schedule.startDate).toDate();
  const detail = {
    DAILY: '',
    WEEKLY: start.toLocaleDateString(locale(), { weekday: 'short' }),
    MONTHLY: t('recurring.schedule.dayOfMonth', { day: start.getDate() }),
    YEARLY: start.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }),
  }[schedule.frequency];
  const every =
    schedule.interval === 1
      ? t(`recurring.schedule.every1.${schedule.frequency}`)
      : t(`recurring.schedule.everyN.${schedule.frequency}`, { count: schedule.interval });
  return detail ? `${every} ${detail}` : every;
}
