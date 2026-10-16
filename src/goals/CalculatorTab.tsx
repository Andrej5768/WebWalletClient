import { BarChart } from '@mantine/charts';
import { moneyAxis } from '../components/chartAxis';
import { Card, Checkbox, NumberInput, SegmentedControl, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';
import { useBaseCurrency } from '../api/queries';
import { Figure } from '../components/Figure';
import { MoneyInput } from '../components/MoneyInput';
import { kyivToday } from '../lib/periods';
import { compound, loadStored, store, type Capitalization, type CompoundInput } from './fire';
import classes from './goals.module.css';

const STORAGE_KEY = 'ww-compound';
const CAPITALIZATIONS: Capitalization[] = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

/** Values of the form, in percent where the calculation takes shares; an empty field is ''. */
interface Values {
  initial: number | '';
  monthly: number | '';
  rate: number | '';
  years: number | '';
  capitalization: Capitalization;
  growth: number | '';
  inflation: number | '';
  real: boolean;
}

const DEFAULTS: Values = {
  initial: 100000,
  monthly: 10000,
  rate: 12,
  years: 10,
  capitalization: 'MONTHLY',
  growth: 5,
  inflation: 8,
  real: false,
};

/** Compound interest calculator: growth of an initial sum and monthly contributions. */
export function CalculatorTab() {
  const { t } = useTranslation();
  const currency = useBaseCurrency();
  const [values, setValues] = useState<Values>(() => loadStored<Values>(STORAGE_KEY, DEFAULTS));
  const set = <K extends keyof Values>(field: K, value: Values[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    store(STORAGE_KEY, next);
  };
  const field = (value: number | string): number | '' => (typeof value === 'number' ? value : '');
  const num = (value: number | '') => (value === '' ? 0 : value);

  const input: CompoundInput = {
    initial: num(values.initial),
    monthly: num(values.monthly),
    rate: num(values.rate) / 100,
    years: Math.min(60, Math.max(1, num(values.years))),
    capitalization: values.capitalization,
    growth: num(values.growth) / 100,
    inflation: num(values.inflation) / 100,
    real: values.real,
  };
  const result = compound(input);
  const money = (amount: number) => formatMoney(amount, currency, { decimals: 0 });
  const thisYear = kyivToday().year();
  const contributed = t('goals.calc.contributed');
  const interest = t('goals.calc.interest');

  return (
    <div className={classes.two}>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Text fw={600}>{t('goals.calc.parameters')}</Text>
          <MoneyInput
            label={t('goals.calc.initial')}
            currency={currency}
            value={values.initial}
            onChange={(value) => set('initial', field(value))}
          />
          <MoneyInput
            label={t('goals.calc.monthly')}
            currency={currency}
            value={values.monthly}
            onChange={(value) => set('monthly', field(value))}
          />
          <SimpleGrid cols={2}>
            <NumberInput
              label={t('goals.calc.rate')}
              suffix=" %"
              decimalScale={2}
              min={0}
              max={100}
              value={values.rate}
              onChange={(value) => set('rate', field(value))}
            />
            <NumberInput
              label={t('goals.calc.years')}
              min={1}
              max={60}
              allowDecimal={false}
              value={values.years}
              onChange={(value) => set('years', field(value))}
            />
          </SimpleGrid>
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t('goals.calc.capitalization')}
            </Text>
            <SegmentedControl
              aria-label={t('goals.calc.capitalization')}
              value={values.capitalization}
              onChange={(value) => set('capitalization', value as Capitalization)}
              data={CAPITALIZATIONS.map((value) => ({
                value,
                label: t(`goals.calc.capitalizations.${value}`),
              }))}
            />
          </Stack>
          <NumberInput
            label={t('goals.calc.growth')}
            suffix=" %"
            decimalScale={2}
            min={0}
            max={100}
            value={values.growth}
            onChange={(value) => set('growth', field(value))}
          />
          <NumberInput
            label={t('goals.calc.inflation')}
            suffix=" %"
            decimalScale={2}
            min={0}
            max={100}
            value={values.inflation}
            onChange={(value) => set('inflation', field(value))}
          />
          <Checkbox
            label={t('goals.calc.real')}
            checked={values.real}
            onChange={(event) => set('real', event.currentTarget.checked)}
          />
        </Stack>
      </Card>

      <Stack gap="md">
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <Figure label={t('goals.calc.final')} value={money(result.balance)} />
          <Figure label={contributed} value={money(result.contributed)} />
          <Figure label={t('goals.calc.interestTotal')} value={money(result.interest)} className="income" />
          <Figure label={t('goals.calc.realFinal')} value={money(result.realBalance)} className="muted" />
        </SimpleGrid>
        <Card withBorder radius="md" padding="lg">
          <Text fw={600} mb="sm">
            {t('goals.calc.byYear')}
          </Text>
          <BarChart
            h={240}
            type="stacked"
            data={result.rows.map((row) => ({
              year: String(thisYear + row.year),
              [contributed]: Math.round(row.contributed),
              [interest]: Math.round(row.balance - row.contributed),
            }))}
            dataKey="year"
            series={[
              { name: contributed, color: 'blue.6' },
              { name: interest, color: 'teal.6' },
            ]}
            valueFormatter={(value) => money(value)}
            yAxisProps={moneyAxis}
            withLegend
            gridAxis="y"
            tickLine="none"
          />
        </Card>
        <Card withBorder radius="md" padding={0} style={{ overflowX: 'auto' }}>
          <Table striped={false} highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('goals.calc.year')}</Table.Th>
                <Table.Th ta="right">{contributed}</Table.Th>
                <Table.Th ta="right">{interest}</Table.Th>
                <Table.Th ta="right">{t('goals.calc.balance')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.rows.map((row) => (
                <Table.Tr key={row.year}>
                  <Table.Td>{thisYear + row.year}</Table.Td>
                  <Table.Td ta="right" className="num">
                    {money(row.contributed)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {money(row.balance - row.contributed)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {money(row.balance)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      </Stack>
    </div>
  );
}
