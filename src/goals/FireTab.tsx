import { LineChart } from '@mantine/charts';
import { Anchor, Card, Group, NumberInput, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountsSummary } from '../api/queries';
import { Figure, ShareBar } from '../components/Figure';
import { MoneyInput } from '../components/MoneyInput';
import { formatPercent } from '../lib/format';
import { kyivToday } from '../lib/periods';
import { fire, loadStored, store } from './fire';
import { useAverages } from './useAverages';
import { wholeMoney } from './wholeMoney';
import classes from './goals.module.css';

const STORAGE_KEY = 'ww-fire';

/** Values the viewer changed (an emptied field is ''); the rest follow the data. */
interface Overrides {
  expenses?: number | '';
  withdrawalRate?: number | '';
  realReturn?: number | '';
  monthlySavings?: number | '';
}

const DEFAULT_RATE = 4;
const DEFAULT_RETURN = 5;

/** FIRE: the capital that covers the expenses forever, and when it is reached at the current pace. */
export function FireTab() {
  const { t } = useTranslation();
  const summary = useAccountsSummary();
  const averages = useAverages();
  const [overrides, setOverrides] = useState<Overrides>(() => loadStored<Overrides>(STORAGE_KEY, {}));

  if (summary.isPending || averages.query.isPending) return <Skeleton height={420} radius="md" />;

  const currency = summary.data?.currency ?? averages.currency;
  const money = (amount: number) => wholeMoney(amount, currency);
  const change = (field: keyof Overrides, value: number | string) => {
    const next = { ...overrides, [field]: typeof value === 'number' ? value : '' };
    setOverrides(next);
    store(STORAGE_KEY, next);
  };
  const reset = () => {
    setOverrides({});
    store(STORAGE_KEY, {});
  };

  // A field shows what was typed; an emptied one counts as its default
  const shown = (value: number | '' | undefined, fallback: number) =>
    value === undefined ? fallback : value;
  const used = (value: number | '' | undefined, fallback: number) =>
    typeof value === 'number' ? value : fallback;
  const defaults = {
    expenses: Math.round((averages.monthlyExpenses ?? 0) * 12),
    withdrawalRate: DEFAULT_RATE,
    realReturn: DEFAULT_RETURN,
    monthlySavings: Math.max(0, Math.round(averages.monthlySavings ?? 0)),
  };
  const expenses = used(overrides.expenses, defaults.expenses);
  const ratePercent = used(overrides.withdrawalRate, defaults.withdrawalRate);
  const returnPercent = used(overrides.realReturn, defaults.realReturn);
  const monthlySavings = used(overrides.monthlySavings, defaults.monthlySavings);
  const capital = summary.data?.netWorth ?? 0;
  const result = fire({
    expenses,
    withdrawalRate: ratePercent / 100,
    realReturn: returnPercent / 100,
    yearlySavings: monthlySavings * 12,
    capital,
  });
  const thisYear = kyivToday().year();
  const progress = result.target > 0 ? capital / result.target : 0;
  const fireYear = result.years !== null ? thisYear + result.years : null;
  const levels = [
    { key: 'lean', value: result.levels.lean },
    { key: 'regular', value: result.levels.regular },
    { key: 'fat', value: result.levels.fat },
    { key: 'coast', value: result.levels.coast },
  ] as const;
  const capitalLabel = t('goals.fire.capital');

  return (
    <div className={classes.two}>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>{t('goals.fire.inputs')}</Text>
            {Object.keys(overrides).length > 0 && (
              <Anchor component="button" type="button" size="xs" onClick={reset}>
                {t('goals.fire.reset')}
              </Anchor>
            )}
          </Group>
          <MoneyInput
            label={t('goals.fire.expenses')}
            description={
              averages.monthlyExpenses != null
                ? t('goals.fire.expensesHint', { amount: money(averages.monthlyExpenses) })
                : undefined
            }
            inputWrapperOrder={['label', 'input', 'description']}
            currency={currency}
            value={shown(overrides.expenses, defaults.expenses)}
            onChange={(value) => change('expenses', value)}
          />
          <NumberInput
            label={t('goals.fire.withdrawalRate')}
            description={t('goals.fire.withdrawalRateHint')}
            inputWrapperOrder={['label', 'input', 'description']}
            suffix=" %"
            decimalScale={2}
            min={0.5}
            max={10}
            value={shown(overrides.withdrawalRate, defaults.withdrawalRate)}
            onChange={(value) => change('withdrawalRate', value)}
          />
          <NumberInput
            label={t('goals.fire.realReturn')}
            description={t('goals.fire.realReturnHint')}
            inputWrapperOrder={['label', 'input', 'description']}
            suffix=" %"
            decimalScale={2}
            min={-10}
            max={30}
            value={shown(overrides.realReturn, defaults.realReturn)}
            onChange={(value) => change('realReturn', value)}
          />
          <MoneyInput
            label={t('goals.fire.monthlySavings')}
            description={
              averages.monthlySavings != null
                ? t('goals.fire.monthlySavingsHint', { rate: formatPercent(averages.savingsRate) })
                : undefined
            }
            inputWrapperOrder={['label', 'input', 'description']}
            currency={currency}
            value={shown(overrides.monthlySavings, defaults.monthlySavings)}
            onChange={(value) => change('monthlySavings', value)}
          />
        </Stack>
      </Card>

      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Figure
            label={t('goals.fire.number')}
            value={Number.isFinite(result.target) ? money(result.target) : '—'}
            note={t('goals.fire.numberNote', { rate: `${ratePercent} %` })}
          />
          <Figure
            label={t('goals.fire.years')}
            value={result.years !== null ? String(result.years) : '60+'}
            note={fireYear !== null ? t('goals.fire.yearNote', { year: fireYear }) : t('goals.fire.tooFar')}
          />
        </SimpleGrid>
        <Card withBorder radius="md" padding="lg">
          <Stack gap={8}>
            <Group justify="space-between">
              <Text size="sm">{t('goals.fire.capitalNow', { amount: money(capital) })}</Text>
              <Text className="num" size="sm" fw={600}>
                {formatPercent(Math.min(1, progress))}
              </Text>
            </Group>
            <ShareBar share={progress} />
          </Stack>
        </Card>
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          {levels.map((level) => (
            <Card key={level.key} withBorder radius="md" padding="md">
              <Text size="xs" c="dimmed" fw={500}>
                {t(`goals.fire.levels.${level.key}`)}
              </Text>
              <Text className="num" fw={600} mt={4}>
                {Number.isFinite(level.value) ? money(level.value) : '—'}
              </Text>
              <Text size="xs" c="dimmed">
                {t(`goals.fire.levels.${level.key}Note`)}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
        <Card withBorder radius="md" padding="lg">
          <Text fw={600} mb="sm">
            {t('goals.fire.projection')}
          </Text>
          <LineChart
            h={260}
            data={result.path.map((value, index) => ({
              year: String(thisYear + index),
              [capitalLabel]: Math.round(value),
            }))}
            dataKey="year"
            series={[{ name: capitalLabel, color: 'blue.6' }]}
            referenceLines={[
              ...(Number.isFinite(result.target)
                ? [{ y: Math.round(result.target), color: 'orange.6', label: t('goals.fire.number') }]
                : []),
              ...(fireYear !== null
                ? [
                    {
                      x: String(fireYear),
                      color: 'gray.6',
                      label: t('goals.fire.reachedIn', { year: fireYear }),
                    },
                  ]
                : []),
            ]}
            valueFormatter={(value) => money(value)}
            withDots={false}
            gridAxis="y"
            tickLine="none"
          />
        </Card>
      </Stack>
    </div>
  );
}
