import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAccounts, useCategoriesById } from '../api/queries';
import { Figure } from '../components/Figure';
import { QueryError, UnconvertedAlert } from '../components/feedback';
import { formatDate, formatDayShort, formatPercent } from '../lib/format';
import { formatMoney } from '../lib/money';
import { isoDate, kyivToday } from '../lib/periods';
import {
  invalidateTaxes,
  markQuarterPaid,
  markTransaction,
  useFopReport,
  useTaxSettings,
  type FopIncome,
  type FopReport,
} from './api';
import { downloadCsv, esvMonthly, fopRateText, initialQuarter, markFor, quarterState } from './model';

const uah = (value: number, signed = false) => formatMoney(value, 'UAH', { signed });
const rate = (value: number) => formatPercent(value / 100);

/** The taxes of the sole proprietor by quarter, with the incomes they come from. */
export function FopTab({ year, onRates }: { year: number; onRates(): void }) {
  const { t } = useTranslation();
  const report = useFopReport(year);
  const settings = useTaxSettings(year);
  const accounts = useAccounts();
  const categoriesById = useCategoriesById();
  const [picked, setPicked] = useState<number | null>(null);
  const today = isoDate(kyivToday());

  if (report.isLoading) return <Skeleton height={420} radius="md" />;
  if (!report.data) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const rates = data.rates;
  const quarter = picked ?? initialQuarter(data.quarters, year, today);
  const fopAccounts = (accounts.data ?? []).filter((account) => data.fopAccountIds.includes(account.id));
  const categories = (settings.data?.incomeCategoryIds ?? [])
    .map((id) => categoriesById.get(id)?.name)
    .filter(Boolean);
  const { single, military } = fopRateText(rates, rate, (value) => uah(value));
  const totals = data.totals;
  const limitShare = data.incomeLimit > 0 ? totals.income / data.incomeLimit : 0;

  return (
    <Stack gap="lg">
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      {fopAccounts.length === 0 && categories.length === 0 ? (
        <Alert color="yellow" variant="light" icon={<TriangleAlert size={16} />}>
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm">{t('taxes.fop.noSources')}</Text>
            <Button size="xs" variant="default" onClick={onRates}>
              {t('taxes.fop.chooseCategories')}
            </Button>
          </Group>
        </Alert>
      ) : (
        <Alert color="blue" variant="light" icon={<Info size={16} />}>
          <Group justify="space-between" wrap="wrap" gap="xs" align="flex-start">
            <Text size="sm" style={{ flex: '1 1 420px' }}>
              {t(rates.fopGroup === 3 ? 'taxes.fop.summary3' : 'taxes.fop.summary12', {
                group: rates.fopGroup,
                single,
                military,
                esv: rates.esvEnabled ? uah(esvMonthly(rates)) : t('taxes.fop.noEsv'),
              })}{' '}
              {t('taxes.fop.sources', {
                sources: [
                  ...fopAccounts.map((account) => account.name),
                  ...categories.map((name) => t('taxes.fop.category', { name })),
                ].join(', '),
              })}
            </Text>
            <Button size="xs" variant="default" onClick={onRates}>
              {t('taxes.change')}
            </Button>
          </Group>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }} spacing="sm">
        <Figure
          label={t('taxes.fop.income', { year })}
          value={uah(totals.income)}
          note={t('taxes.fop.incomeNote')}
        />
        <Figure label={t('taxes.fop.singleTax', { rate: single })} value={uah(totals.singleTax)} />
        <Figure label={t('taxes.fop.military', { rate: military })} value={uah(totals.military)} />
        <Figure
          label={t('taxes.fop.esv')}
          value={uah(totals.esv)}
          note={
            rates.esvEnabled
              ? t('taxes.fop.esvNote', { amount: uah(esvMonthly(rates)) })
              : t('taxes.fop.noEsv')
          }
        />
        <Figure
          label={t('taxes.fop.total')}
          value={uah(totals.total)}
          note={
            totals.income > 0
              ? t('taxes.fop.totalShare', { share: formatPercent(totals.total / totals.income) })
              : undefined
          }
        />
      </SimpleGrid>

      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" mb={8}>
          <Text fw={600}>{t('taxes.fop.limit', { year, group: rates.fopGroup })}</Text>
          <Text size="sm" c="dimmed" className="num">
            {t('taxes.fop.limitUsed', { used: uah(totals.income), limit: uah(data.incomeLimit) })}
          </Text>
        </Group>
        <Progress
          value={Math.min(100, limitShare * 100)}
          color={limitShare > 1 ? 'red' : limitShare > 0.9 ? 'yellow' : 'cobalt'}
          aria-label={t('taxes.fop.limitLabel')}
        />
        <Text size="xs" c="dimmed" mt={8}>
          {t('taxes.fop.limitHint')}
        </Text>
      </Card>

      <Quarters data={data} year={year} today={today} selected={quarter} onSelect={setPicked} />
      <Incomes
        year={year}
        quarter={quarter}
        incomes={data.incomes.filter((income) => income.quarter === quarter)}
        all={data.incomes}
      />
    </Stack>
  );
}

function Quarters({
  data,
  year,
  today,
  selected,
  onSelect,
}: {
  data: FopReport;
  year: number;
  today: string;
  selected: number;
  onSelect(quarter: number): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const paid = useMutation({
    mutationFn: ({ quarter, value }: { quarter: number; value: boolean }) =>
      markQuarterPaid(year, quarter, value),
    onSuccess: () => invalidateTaxes(queryClient),
  });
  return (
    <Card withBorder radius="md" p={0}>
      <Group justify="space-between" px="lg" py="sm" wrap="wrap">
        <Title order={2} size="h4">
          {t('taxes.fop.quarters')}
        </Title>
        <Text size="xs" c="dimmed">
          {t(data.rates.fopGroup === 3 ? 'taxes.fop.deadlines3' : 'taxes.fop.deadlines12')}
        </Text>
      </Group>
      <div style={{ overflowX: 'auto' }}>
        <Table verticalSpacing="sm" horizontalSpacing="lg" miw={980} highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('taxes.fop.columns.quarter')}</Table.Th>
              <Table.Th ta="right">{t('taxes.fop.columns.income')}</Table.Th>
              <Table.Th ta="right">{t('taxes.fop.columns.single')}</Table.Th>
              <Table.Th ta="right">{t('taxes.fop.columns.military')}</Table.Th>
              <Table.Th ta="right">{t('taxes.fop.columns.esv')}</Table.Th>
              <Table.Th>{t('taxes.fop.columns.declaration')}</Table.Th>
              <Table.Th>{t('taxes.fop.columns.pay')}</Table.Th>
              <Table.Th>{t('taxes.fop.columns.state')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.quarters.map((quarter) => {
              const state = quarterState(quarter, year, today);
              return (
                <Table.Tr
                  key={quarter.quarter}
                  style={
                    selected === quarter.quarter
                      ? { background: 'var(--mantine-color-cobalt-light)' }
                      : undefined
                  }
                >
                  <Table.Td>
                    <Anchor
                      component="button"
                      type="button"
                      fw={500}
                      onClick={() => onSelect(quarter.quarter)}
                      aria-pressed={selected === quarter.quarter}
                    >
                      {t('taxes.fop.quarter', { quarter: quarter.quarter })}
                    </Anchor>
                  </Table.Td>
                  <Table.Td ta="right" className="num" fw={500}>
                    {uah(quarter.income)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {uah(quarter.singleTax)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {uah(quarter.military)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {uah(quarter.esv)}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {quarter.declarationDue ? formatDayShort(quarter.declarationDue) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {t('taxes.fop.payTax', { date: formatDayShort(quarter.taxDue) })}
                    </Text>
                    {quarter.esv > 0 && (
                      <Text size="sm" c="dimmed">
                        {t('taxes.fop.payEsv', { date: formatDayShort(quarter.esvDue) })}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4} align="flex-start">
                      {state === 'paid' && (
                        <Badge color="green" variant="light" style={{ textTransform: 'none' }}>
                          {t('taxes.fop.paid')}
                        </Badge>
                      )}
                      {state === 'due' && (
                        <Badge color="yellow" variant="light" style={{ textTransform: 'none' }}>
                          {t('taxes.fop.due', { amount: uah(quarter.total) })}
                        </Badge>
                      )}
                      {state === 'running' && (
                        <Badge color="gray" variant="light" style={{ textTransform: 'none' }}>
                          {t('taxes.fop.running')}
                        </Badge>
                      )}
                      {state !== 'running' && (
                        <Checkbox
                          size="xs"
                          label={t('taxes.fop.markPaid')}
                          aria-label={t('taxes.fop.markPaidOf', { quarter: quarter.quarter })}
                          checked={quarter.paid}
                          disabled={paid.isPending}
                          onChange={(event) =>
                            paid.mutate({ quarter: quarter.quarter, value: event.currentTarget.checked })
                          }
                        />
                      )}
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>
    </Card>
  );
}

function Incomes({
  year,
  quarter,
  incomes,
  all,
}: {
  year: number;
  quarter: number;
  incomes: FopIncome[];
  all: FopIncome[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mark = useMutation({
    mutationFn: ({ income, include }: { income: FopIncome; include: boolean }) =>
      markTransaction(
        income.transactionId,
        markFor(include, income.reason === 'MANUAL' ? null : income.reason),
      ),
    onSuccess: () => invalidateTaxes(queryClient),
  });
  const exportCsv = () =>
    downloadCsv(`fop-${year}.csv`, [
      [
        t('taxes.fop.columns.date'),
        t('taxes.fop.columns.quarter'),
        t('taxes.fop.columns.payer'),
        t('taxes.fop.columns.account'),
        t('taxes.fop.columns.amount'),
        t('taxes.fop.columns.currency'),
        t('taxes.fop.columns.rate'),
        t('taxes.fop.columns.uah'),
        t('taxes.fop.columns.included'),
        t('taxes.fop.columns.reason'),
      ],
      ...all.map((income) => [
        income.date,
        income.quarter,
        income.payee ?? income.comment ?? '',
        income.accountName,
        income.amount,
        income.currency,
        income.rate,
        income.amountUah,
        income.included ? t('taxes.yes') : t('taxes.no'),
        t(`taxes.fop.reasons.${income.reason}`),
      ]),
    ]);

  return (
    <Card withBorder radius="md" p={0}>
      <Group justify="space-between" px="lg" py="sm" wrap="wrap">
        <Stack gap={0}>
          <Title order={2} size="h4">
            {t('taxes.fop.incomesOf', { quarter, year })}
          </Title>
          <Text size="xs" c="dimmed">
            {t('taxes.fop.incomesHint')}
          </Text>
        </Stack>
        <Button
          size="xs"
          variant="default"
          leftSection={<Download size={14} />}
          onClick={exportCsv}
          disabled={!all.length}
        >
          {t('taxes.csv')}
        </Button>
      </Group>
      {incomes.length === 0 ? (
        <Text size="sm" c="dimmed" px="lg" pb="lg">
          {t('taxes.fop.noIncomes')}
        </Text>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <Table verticalSpacing="sm" horizontalSpacing="lg" miw={820}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('taxes.fop.columns.date')}</Table.Th>
                <Table.Th>{t('taxes.fop.columns.payer')}</Table.Th>
                <Table.Th ta="right">{t('taxes.fop.columns.amount')}</Table.Th>
                <Table.Th ta="right">{t('taxes.fop.columns.rate')}</Table.Th>
                <Table.Th ta="right">{t('taxes.fop.columns.uah')}</Table.Th>
                <Table.Th>{t('taxes.fop.columns.included')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {incomes.map((income) => {
                const payer = income.payee ?? income.comment ?? t('taxes.fop.noPayer');
                return (
                  <Table.Tr key={income.transactionId} style={{ opacity: income.included ? 1 : 0.55 }}>
                    <Table.Td>
                      <Text size="sm" c="dimmed" className="num">
                        {formatDate(income.date)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {payer}
                      </Text>
                      <Group gap={6}>
                        <Text size="xs" c="dimmed">
                          {income.accountName}
                        </Text>
                        <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
                          {t(`taxes.fop.reasons.${income.reason}`)}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right" className="num">
                      {formatMoney(income.amount, income.currency)}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="dimmed" className="num">
                        {income.rate != null ? income.rate.toFixed(4).replace('.', ',') : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right" className="num" fw={500}>
                      {!income.included
                        ? t('taxes.fop.notIncome')
                        : income.amountUah != null
                          ? uah(income.amountUah)
                          : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={income.included}
                        disabled={mark.isPending}
                        aria-label={t('taxes.fop.includeOf', { payer, date: formatDate(income.date) })}
                        onChange={(event) => mark.mutate({ income, include: event.currentTarget.checked })}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      )}
      <Text size="xs" c="dimmed" px="lg" pb="md">
        {t('taxes.fop.addHint')}{' '}
        <Anchor component={Link} to="/transactions" size="xs">
          {t('taxes.fop.toTransactions')}
        </Anchor>
      </Text>
    </Card>
  );
}
