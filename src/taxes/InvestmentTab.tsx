import {
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Figure } from '../components/Figure';
import { QueryError, UnconvertedAlert } from '../components/feedback';
import { formatDate, formatDay, formatPercent } from '../lib/format';
import { formatMoney, formatQuantity } from '../lib/money';
import { invalidateTaxes, markDividendDocument, useInvestmentTax, type InvestmentTaxReport } from './api';
import { downloadCsv } from './model';

const uah = (value: number, signed = false) => formatMoney(value, 'UAH', { signed });
const rate = (value: number) => formatPercent(value / 100);

/** The taxes of the dividends and sales of a year and what goes to the yearly declaration. */
export function InvestmentTab({ year, onRates }: { year: number; onRates(): void }) {
  const { t } = useTranslation();
  const report = useInvestmentTax(year);
  const queryClient = useQueryClient();
  const document = useMutation({
    mutationFn: ({ operationId, value }: { operationId: number; value: boolean }) =>
      markDividendDocument(operationId, value),
    onSuccess: () => invalidateTaxes(queryClient),
  });

  if (report.isLoading) return <Skeleton height={420} radius="md" />;
  if (!report.data) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const rates = data.rates;
  const exportCsv = () => downloadCsv(`investments-${year}.csv`, csvRows(data, t));

  return (
    <Stack gap="lg">
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <Alert color="blue" variant="light" icon={<Info size={16} />}>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm" style={{ flex: '1 1 420px' }}>
            {t('taxes.investments.summary', {
              pdfo: rate(rates.pdfoRate),
              military: rate(rates.investmentMilitaryRate),
            })}
          </Text>
          <Button size="xs" variant="default" onClick={onRates}>
            {t('taxes.change')}
          </Button>
        </Group>
      </Alert>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
        <Figure
          label={t('taxes.investments.dividends', { year })}
          value={uah(data.dividendsUah)}
          note={t('taxes.investments.dividendsNote', { count: data.dividends.length })}
        />
        <Figure
          label={t('taxes.investments.profit')}
          value={uah(data.profit, true)}
          className={data.profit < 0 ? 'expense' : data.profit > 0 ? 'income' : ''}
          note={
            data.carriedIn > 0
              ? t('taxes.investments.carriedNote', { amount: uah(data.carriedIn) })
              : t('taxes.investments.salesNote', { count: data.sales.length })
          }
        />
        <Figure
          label={t('taxes.investments.toPay')}
          value={uah(data.total)}
          note={t('taxes.investments.toPayNote', { pdfo: uah(data.pdfo), military: uah(data.military) })}
        />
        <Figure
          label={t('taxes.investments.declaration')}
          value={t('taxes.investments.until', { date: formatDay(data.declarationDue) })}
          note={t('taxes.investments.paymentNote', { date: formatDay(data.paymentDue) })}
        />
      </SimpleGrid>

      <Section title={t('taxes.investments.dividendsTitle')} hint={t('taxes.investments.dividendsHint')}>
        {data.dividends.length === 0 ? (
          <Empty text={t('taxes.investments.noDividends')} />
        ) : (
          <Table verticalSpacing="sm" horizontalSpacing="md" miw={1000}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('taxes.investments.columns.date')}</Table.Th>
                <Table.Th>{t('taxes.investments.columns.instrument')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.amount')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.rate')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.income')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.withheld')}</Table.Th>
                <Table.Th>{t('taxes.investments.columns.document')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.pdfo')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.military')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.dividends.map((dividend) => (
                <Table.Tr key={dividend.operationId}>
                  <Table.Td>
                    <Text size="sm" c="dimmed" className="num">
                      {formatDate(dividend.date)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" fw={500}>
                      {dividend.symbol}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {formatMoney(dividend.amount, dividend.currency)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed" className="num">
                      {dividend.rate != null ? dividend.rate.toFixed(4).replace('.', ',') : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {uah(dividend.amountUah)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {uah(dividend.withheldUah)}
                  </Table.Td>
                  <Table.Td>
                    {dividend.withheldUah > 0 ? (
                      <Checkbox
                        size="xs"
                        label={t(dividend.document ? 'taxes.yes' : 'taxes.no')}
                        aria-label={t('taxes.investments.documentOf', {
                          symbol: dividend.symbol,
                          date: formatDate(dividend.date),
                        })}
                        checked={dividend.document}
                        disabled={document.isPending}
                        onChange={(event) =>
                          document.mutate({
                            operationId: dividend.operationId,
                            value: event.currentTarget.checked,
                          })
                        }
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right" className="num" fw={500}>
                    {uah(dividend.pdfo)}
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {uah(dividend.military)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Section>

      <Section title={t('taxes.investments.salesTitle')} hint={t('taxes.investments.salesHint')}>
        {data.sales.length === 0 ? (
          <Empty text={t('taxes.investments.noSales')} />
        ) : (
          <Table verticalSpacing="sm" horizontalSpacing="md" miw={900}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('taxes.investments.columns.date')}</Table.Th>
                <Table.Th>{t('taxes.investments.columns.instrument')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.quantity')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.income')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.cost')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.result')}</Table.Th>
                <Table.Th ta="right">{t('taxes.investments.columns.inCurrency')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.sales.map((sale) => (
                <Table.Tr key={sale.operationId}>
                  <Table.Td>
                    <Text size="sm" c="dimmed" className="num">
                      {formatDate(sale.date)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" fw={500}>
                      {sale.symbol}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" className="num">
                    {formatQuantity(sale.quantity)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" className="num">
                      {uah(sale.incomeUah)}
                    </Text>
                    <Text size="xs" c="dimmed" className="num">
                      {formatMoney(sale.proceeds, sale.currency)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" className="num">
                      {uah(sale.costUah)}
                    </Text>
                    <Text size="xs" c="dimmed" className="num">
                      {formatMoney(sale.cost, sale.currency)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={600} className={`num ${sale.resultUah < 0 ? 'expense' : 'income'}`}>
                      {uah(sale.resultUah, true)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed" className="num">
                      {formatMoney(sale.resultInCurrency, sale.currency, { signed: true })}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Section>

      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Title order={2} size="h4">
            {t('taxes.investments.declarationTitle', { year })}
          </Title>
          <Text size="sm" c="dimmed">
            {t('taxes.investments.deadlines', {
              declaration: formatDay(data.declarationDue),
              payment: formatDay(data.paymentDue),
            })}
          </Text>
        </Group>
        <Stack gap={6} maw={560}>
          <Line label={t('taxes.investments.lines.dividends')} value={uah(data.dividendsUah)} />
          <Line label={t('taxes.investments.lines.credit')} value={uah(data.creditUah)} />
          <Line label={t('taxes.investments.lines.profit')} value={uah(data.profit, true)} />
          <Line label={t('taxes.investments.lines.carriedIn')} value={uah(-data.carriedIn)} />
          <Line label={t('taxes.investments.lines.taxable')} value={uah(data.taxableProfit)} />
          <Line
            label={t('taxes.investments.lines.pdfo', { rate: rate(rates.pdfoRate) })}
            value={uah(data.pdfo)}
          />
          <Line
            label={t('taxes.investments.lines.military', { rate: rate(rates.investmentMilitaryRate) })}
            value={uah(data.military)}
          />
          <Line label={t('taxes.investments.lines.total')} value={uah(data.total)} bold />
          {data.carriedOut > 0 && (
            <Text size="xs" c="dimmed">
              {t('taxes.investments.carriedOut', { amount: uah(data.carriedOut) })}
            </Text>
          )}
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button size="xs" variant="default" leftSection={<Download size={14} />} onClick={exportCsv}>
            {t('taxes.csvAll')}
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <Card withBorder radius="md" p={0}>
      <Stack gap={0} px="lg" py="sm">
        <Title order={2} size="h4">
          {title}
        </Title>
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      </Stack>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Text size="sm" c="dimmed" px="lg" pb="lg">
      {text}
    </Text>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      pt={bold ? 8 : 0}
      style={bold ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined}
    >
      <Text size="sm" c={bold ? undefined : 'dimmed'} fw={bold ? 600 : undefined}>
        {label}
      </Text>
      <Text size="sm" className="num" fw={bold ? 600 : 500}>
        {value}
      </Text>
    </Group>
  );
}

function csvRows(data: InvestmentTaxReport, t: (key: string, options?: Record<string, unknown>) => string) {
  return [
    [t('taxes.investments.dividendsTitle')],
    [
      t('taxes.investments.columns.date'),
      t('taxes.investments.columns.instrument'),
      t('taxes.investments.columns.amount'),
      t('taxes.investments.columns.currency'),
      t('taxes.investments.columns.rate'),
      t('taxes.investments.columns.income'),
      t('taxes.investments.columns.withheld'),
      t('taxes.investments.columns.document'),
      t('taxes.investments.columns.pdfo'),
      t('taxes.investments.columns.military'),
    ],
    ...data.dividends.map((dividend) => [
      dividend.date,
      dividend.symbol,
      dividend.amount,
      dividend.currency,
      dividend.rate,
      dividend.amountUah,
      dividend.withheldUah,
      dividend.document ? t('taxes.yes') : t('taxes.no'),
      dividend.pdfo,
      dividend.military,
    ]),
    [],
    [t('taxes.investments.salesTitle')],
    [
      t('taxes.investments.columns.date'),
      t('taxes.investments.columns.instrument'),
      t('taxes.investments.columns.quantity'),
      t('taxes.investments.columns.currency'),
      t('taxes.investments.columns.proceeds'),
      t('taxes.investments.columns.costInCurrency'),
      t('taxes.investments.columns.income'),
      t('taxes.investments.columns.cost'),
      t('taxes.investments.columns.result'),
    ],
    ...data.sales.map((sale) => [
      sale.date,
      sale.symbol,
      sale.quantity,
      sale.currency,
      sale.proceeds,
      sale.cost,
      sale.incomeUah,
      sale.costUah,
      sale.resultUah,
    ]),
    [],
    [t('taxes.investments.lines.dividends'), data.dividendsUah],
    [t('taxes.investments.lines.credit'), data.creditUah],
    [t('taxes.investments.lines.profit'), data.profit],
    [t('taxes.investments.lines.carriedIn'), data.carriedIn],
    [t('taxes.investments.lines.taxable'), data.taxableProfit],
    [t('taxes.investments.lines.pdfo', { rate: '' }), data.pdfo],
    [t('taxes.investments.lines.military', { rate: '' }), data.military],
    [t('taxes.investments.lines.total'), data.total],
  ];
}
