import { Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { DividendStatus } from './model';

const COLORS: Record<DividendStatus, string> = {
  RECEIVED: 'green',
  EXPECTED: 'yellow',
  DECLARED: 'blue',
  FORECAST: 'gray',
};

export function StatusBadge({ status }: { status: DividendStatus }) {
  const { t } = useTranslation();
  return (
    <Badge
      size="sm"
      variant={status === 'FORECAST' ? 'outline' : 'light'}
      color={COLORS[status]}
      style={{ textTransform: 'none' }}
    >
      {t(`invDividends.status.${status}`)}
    </Badge>
  );
}
