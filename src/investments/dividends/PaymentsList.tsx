import { Text } from '@mantine/core';
import dayjs from 'dayjs';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { locale } from '../../i18n';
import { formatDayShort, formatMonthTitle, formatPercent } from '../../lib/format';
import { formatMoney, formatQuantity } from '../../lib/money';
import type { DividendEvent } from '../api';
import classes from './dividends.module.css';
import { shortName } from './model';
import { StatusBadge } from './StatusBadge';

/** The payments by month: amounts in the currency of the security, totals in that of the calendar. */
export function PaymentsList({
  events,
  currency,
  accountNames,
}: {
  events: DividendEvent[];
  currency: string;
  accountNames: Map<number, string>;
}) {
  const { t } = useTranslation();
  const months = new Map<string, DividendEvent[]>();
  for (const event of events) {
    const month = event.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), event]);
  }
  const taxNote = (event: DividendEvent) => {
    if (event.tax === 0) return t('invDividends.taxFree');
    if (!event.taxEstimated) return t('invDividends.taxWithheld');
    return t('invDividends.taxEstimate', { rate: formatPercent(event.gross ? event.tax / event.gross : 0) });
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 1040 }}>
        <div className={`${classes.row} ${classes.head}`}>
          <span>{t('invDividends.columns.date')}</span>
          <span>{t('invDividends.columns.holding')}</span>
          <span>{t('invDividends.columns.account')}</span>
          <span>{t('invDividends.columns.quantity')}</span>
          <span className={classes.right}>{t('invDividends.columns.gross')}</span>
          <span className={classes.right}>{t('invDividends.columns.tax')}</span>
          <span className={classes.right}>{t('invDividends.columns.net')}</span>
          <span>{t('invDividends.columns.status')}</span>
        </div>
        {[...months].map(([month, items]) => (
          <Fragment key={month}>
            <div className={classes.monthHeader}>
              <span>{formatMonthTitle(dayjs(`${month}-01`))}</span>
              <span className="num muted">
                {formatMoney(
                  items.reduce((sum, event) => sum + event.netInTarget, 0),
                  currency,
                )}
              </span>
            </div>
            {items.map((event, index) => (
              <div
                key={`${event.date}-${event.instrumentId}-${event.accountId}-${index}`}
                className={`${classes.row} ${event.status === 'EXPECTED' ? classes.expectedRow : ''}`}
                data-testid="dividend-row"
              >
                <div>
                  <Text size="sm">
                    {formatDayShort(event.date)},{' '}
                    {dayjs(event.date).toDate().toLocaleDateString(locale(), { weekday: 'short' })}
                  </Text>
                  {event.exDate && (
                    <Text size="xs" c="dimmed">
                      {t('invDividends.exDate', { date: formatDayShort(event.exDate) })}
                    </Text>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} ff="monospace">
                    {shortName(event)}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {event.name} · {t(`investments.types.${event.type}`)}
                  </Text>
                </div>
                <Text size="sm" c="dimmed" truncate>
                  {accountNames.get(event.accountId) ?? ''}
                </Text>
                <Text size="sm" className="num">
                  {event.perShare != null
                    ? `${formatQuantity(event.quantity)} × ${formatMoney(event.perShare, event.currency)}`
                    : formatQuantity(event.quantity)}
                </Text>
                <Text size="sm" className={`num ${classes.right}`}>
                  {formatMoney(event.gross, event.currency)}
                </Text>
                <div className={classes.right}>
                  <Text size="sm" className="num">
                    {formatMoney(event.tax, event.currency)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {taxNote(event)}
                  </Text>
                </div>
                <Text size="sm" fw={500} className={`num ${classes.right}`}>
                  {formatMoney(event.net, event.currency)}
                </Text>
                <div>
                  <StatusBadge event={event} />
                </div>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
