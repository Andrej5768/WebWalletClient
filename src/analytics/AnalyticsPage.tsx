import { Stack, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AnalyticsReport } from '../reports/analytics/AnalyticsReport';

/** The analytics section: plan and actual, cash flow, period comparison, trends and savings, each with its period. */
export function AnalyticsPage() {
  const { t } = useTranslation();
  return (
    <Stack gap="lg" maw={1200}>
      <Title order={1} size="h2">
        {t('nav.analytics')}
      </Title>
      <AnalyticsReport />
    </Stack>
  );
}
