import { Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { DividendEvent } from '../api';
import { statusKey, type DividendStatus } from './model';

const COLORS: Record<DividendStatus, string> = {
  RECEIVED: 'green',
  EXPECTED: 'yellow',
  DECLARED: 'blue',
  FORECAST: 'gray',
};

/** The status of a payment; a declared coupon of a bond reads "on schedule". */
export function StatusBadge({ event }: { event: { status: DividendStatus; type: DividendEvent['type'] } }) {
  const status = event.status;
  const { t } = useTranslation();
  return (
    <Badge
      size="sm"
      variant={status === 'FORECAST' ? 'outline' : 'light'}
      color={COLORS[status]}
      style={{ textTransform: 'none' }}
    >
      {t(`invDividends.status.${statusKey(event)}`)}
    </Badge>
  );
}
