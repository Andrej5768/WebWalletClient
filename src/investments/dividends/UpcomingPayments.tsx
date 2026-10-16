import { Anchor, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatDayShort } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { isoDate, kyivToday } from '../../lib/periods';
import { useDividends } from '../api';
import { upcoming } from './model';
import { StatusBadge } from './StatusBadge';

/** The next payments of the brokerage accounts, with a link to the dividend calendar. */
export function UpcomingPayments({ accountId }: { accountId?: number }) {
  const { t } = useTranslation();
  const today = useMemo(() => isoDate(kyivToday()), []);
  const calendar = useDividends({ accountId });
  const next = upcoming(calendar.data?.events ?? [], today, 4);
  const currency = calendar.data?.currency ?? 'UAH';
  const link = `/investments?tab=dividends${accountId ? `&accountId=${accountId}` : ''}`;

  return (
    <Card withBorder radius="md" padding="lg">
      <Text fw={600} mb="sm">
        {t('invDividends.upcoming')}
      </Text>
      {calendar.isLoading ? (
        <Skeleton height={140} />
      ) : next.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('invDividends.upcomingEmpty')}
        </Text>
      ) : (
        <Stack gap="xs">
          {next.map((event, index) => (
            <Group key={`${event.date}-${event.instrumentId}-${index}`} justify="space-between" wrap="nowrap">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} ff="monospace">
                  {event.symbol}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatDayShort(event.date)}
                </Text>
              </Stack>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} className="num">
                  {formatMoney(event.netInTarget, currency)}
                </Text>
                <StatusBadge status={event.status} />
              </Group>
            </Group>
          ))}
        </Stack>
      )}
      <Anchor component={Link} to={link} size="sm" mt="md" display="block">
        {t('invDividends.calendarLink')}
      </Anchor>
    </Card>
  );
}
