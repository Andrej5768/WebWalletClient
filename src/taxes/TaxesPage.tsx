import { Button, Group, SegmentedControl, Skeleton, Stack, Tabs, Text, Title } from '@mantine/core';
import { Percent } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kyivToday } from '../lib/periods';
import { intParam, useUrlParams } from '../lib/useUrlParams';
import { FopTab } from './FopTab';
import { TAB_KEYS, taxYears, type TaxTab } from './model';

const InvestmentTab = lazy(() => import('./InvestmentTab').then((m) => ({ default: m.InvestmentTab })));
const RatesDrawer = lazy(() => import('./RatesDrawer').then((m) => ({ default: m.RatesDrawer })));

/**
 * The taxes of the sole proprietor and of investment income for a year. The URL keeps the tab (`tab`) and the year
 * (`year`, the current one by default).
 */
export function TaxesPage() {
  const { t } = useTranslation();
  const [params, update] = useUrlParams();
  const [ratesOpen, setRatesOpen] = useState(false);
  const current = kyivToday().year();
  const years = taxYears(current);
  const asked = intParam(params, 'year');
  const year = asked && years.includes(asked) ? asked : current;
  const tab: TaxTab = (TAB_KEYS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as TaxTab)
    : 'fop';

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={2}>
          <Title order={1} size="h2">
            {t('taxes.title')}
          </Title>
          <Text size="sm" c="dimmed">
            {t('taxes.subtitle')}
          </Text>
        </Stack>
        <Group gap="sm">
          <SegmentedControl
            aria-label={t('taxes.year')}
            value={String(year)}
            onChange={(value) => update({ year: Number(value) === current ? null : value })}
            data={years.map((value) => String(value))}
          />
          <Button variant="default" leftSection={<Percent size={16} />} onClick={() => setRatesOpen(true)}>
            {t('taxes.ratesButton', { year })}
          </Button>
        </Group>
      </Group>

      <Tabs value={tab} onChange={(value) => update({ tab: value === 'fop' ? null : value })}>
        <Tabs.List>
          {TAB_KEYS.map((value) => (
            <Tabs.Tab key={value} value={value}>
              {t(`taxes.tabs.${value}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Suspense fallback={<Skeleton height={320} radius="md" />}>
        {tab === 'fop' ? (
          <FopTab year={year} onRates={() => setRatesOpen(true)} />
        ) : (
          <InvestmentTab year={year} onRates={() => setRatesOpen(true)} />
        )}
        {ratesOpen && <RatesDrawer year={year} onClose={() => setRatesOpen(false)} />}
      </Suspense>
    </Stack>
  );
}
