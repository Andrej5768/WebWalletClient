import { Text, Tooltip } from '@mantine/core';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../../lib/money';
import type { DividendEvent } from '../api';
import classes from './dividends.module.css';
import { byDay, monthWeeks } from './model';

/** A month by weeks from Monday with the payments of each day, colored by status. */
export function MonthCalendar({
  month,
  events,
  currency,
  today,
}: {
  month: string;
  events: DividendEvent[];
  currency: string;
  today: string;
}) {
  const { t } = useTranslation();
  const days = byDay(events);
  const weekdays = t('invDividends.weekdays', { returnObjects: true }) as string[];
  return (
    <div className={classes.calendar} role="grid" aria-label={month}>
      {weekdays.map((weekday) => (
        <div key={weekday} className={classes.weekday} role="columnheader">
          {weekday}
        </div>
      ))}
      {monthWeeks(month)
        .flat()
        .map((date, index) =>
          date === null ? (
            <div key={`empty-${index}`} className={`${classes.cell} ${classes.outside}`} />
          ) : (
            <div
              key={date}
              className={`${classes.cell} ${date === today ? classes.today : ''}`}
              role="gridcell"
              data-testid={`day-${date}`}
            >
              <span className={classes.dayNumber}>{dayjs(date).date()}</span>
              {(days.get(date) ?? []).map((event, item) => (
                <Tooltip
                  key={`${event.instrumentId}-${event.accountId}-${item}`}
                  label={`${event.name} · ${t(`invDividends.status.${event.status}`)}`}
                  withArrow
                  openDelay={300}
                >
                  <div className={`${classes.payment} ${classes[event.status]}`} data-status={event.status}>
                    <span>{event.symbol}</span>
                    <Text component="span" size="11px" className="num" truncate>
                      {formatMoney(event.grossInTarget, currency)}
                    </Text>
                  </div>
                </Tooltip>
              ))}
            </div>
          ),
        )}
    </div>
  );
}
