import { Alert, Group, SegmentedControl, Stack, Tabs, Text, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { periodOf, type Period, type Preset } from '../transactions/periods';
import { IncomeExpenseReport } from './IncomeExpenseReport';
import { NetWorthReport } from './NetWorthReport';
import { PayeesReport } from './PayeesReport';
import { SpendingReport } from './SpendingReport';

const tabs = ['spending', 'income', 'networth', 'payees'] as const;
type Tab = (typeof tabs)[number];

const PRESETS: Preset[] = ['month', 'prevMonth', 'quarter', 'year', 'twelveMonths', 'custom'];
/** Monthly charts need several months to say anything. */
const DEFAULT_PRESET: Record<Tab, Preset> = {
  spending: 'month',
  income: 'twelveMonths',
  networth: 'twelveMonths',
  payees: 'month',
};

export function ReportsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (tabs as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'spending';
  const preset = (params.get('period') as Preset | null) ?? DEFAULT_PRESET[tab];
  const period: Period = periodOf(preset, new Date(), {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Title order={1} size="h2">
          {t('nav.reports')}
        </Title>
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            aria-label={t('transactions.period')}
            value={preset}
            onChange={(value) => update({ period: value })}
            data={PRESETS.map((value) => ({ value, label: t(`transactions.presets.${value}`) }))}
          />
          {preset === 'custom' ? (
            <DatePickerInput
              type="range"
              aria-label={t('transactions.presets.custom')}
              valueFormat="DD.MM.YYYY"
              w={240}
              value={[params.get('from'), params.get('to')]}
              onChange={([from, to]) => update({ from, to })}
            />
          ) : (
            <Text size="sm" c="dimmed">
              {dayjs(period.from).format('DD.MM.YYYY')} – {dayjs(period.to).format('DD.MM.YYYY')}
            </Text>
          )}
        </Group>
      </Group>

      <Tabs
        value={tab}
        onChange={(value) => update({ tab: value === 'spending' ? null : value, period: null })}
      >
        <Tabs.List>
          {tabs.map((value) => (
            <Tabs.Tab key={value} value={value}>
              {t(`reports.tabs.${value}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {tab === 'spending' && <SpendingReport period={period} />}
      {tab === 'income' && <IncomeExpenseReport period={period} />}
      {tab === 'networth' && <NetWorthReport period={period} />}
      {tab === 'payees' && <PayeesReport period={period} />}
    </Stack>
  );
}

export function UnconvertedAlert({ currencies }: { currencies?: string[] }) {
  const { t } = useTranslation();
  if (!currencies?.length) return null;
  return (
    <Alert color="yellow" variant="light" icon={<TriangleAlert size={18} />}>
      {t('budget.unconverted', { currencies: currencies.join(', ') })}
    </Alert>
  );
}
