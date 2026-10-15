import { BarChart } from '@mantine/charts';
import { Alert, Anchor, Button, Card, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import dayjs from 'dayjs';
import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAccountsSummary, useCategories, useMonobankStatus, useTransactions } from '../api/queries';
import { useBudget } from '../budget/api';
import { flatEnvelopes, monthKey, monthProgress, spentShare } from '../budget/model';
import { CategoryIcon } from '../components/CategoryIcon';
import { locale } from '../i18n';
import { formatMoney } from '../lib/money';
import { mantineColor } from '../lib/palette';
import { useIncomeExpense, useSpending } from '../reports/api';
import { Figure, ShareBar } from '../reports/Figure';
import { displayCategory, signedAmount } from '../transactions/model';
import { periodOf } from '../transactions/periods';
import classes from './dashboard.module.css';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const month = dayjs().startOf('month');
  const thisMonth = periodOf('month', new Date());
  const sixMonths = { from: month.subtract(5, 'month').format('YYYY-MM-DD'), to: thisMonth.to };

  const summary = useAccountsSummary();
  const monthly = useIncomeExpense(sixMonths);
  const spending = useSpending(thisMonth);
  const budget = useBudget(monthKey(month));
  const recent = useTransactions({ page: 0, size: 6 });
  const categories = useCategories();
  const monobank = useMonobankStatus();

  const categoriesById = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );
  const currency = summary.data?.currency ?? 'UAH';
  const current = monthly.data?.months?.at(-1);
  const previousMonths = monthly.data?.months ?? [];
  const progress = monthProgress(month) ?? 1;
  const envelopes = flatEnvelopes(budget.data?.categories ?? [])
    .filter((row) => (row.assigned ?? 0) > 0 || (row.available ?? 0) < 0)
    .sort((a, b) => (a.available ?? 0) - (b.available ?? 0))
    .slice(0, 6);
  const differences = (monobank.data?.accounts ?? []).filter((link) => (link.difference ?? 0) !== 0);
  const monthName = (value?: string) =>
    dayjs(`${value}-01`).toDate().toLocaleDateString(locale(i18n.language), { month: 'short' });

  return (
    <Stack gap="lg" maw={1200}>
      <Stack gap={4}>
        <Title order={1} size="h2">
          {t('nav.dashboard')}
        </Title>
        <Text c="dimmed" tt="capitalize">
          {month.toDate().toLocaleDateString(locale(i18n.language), { month: 'long', year: 'numeric' })}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Figure
          label={t('balance.netWorth.label')}
          value={formatMoney(summary.data?.netWorth ?? 0, currency)}
        />
        <Figure
          label={t('dashboard.income')}
          value={formatMoney(current?.income ?? 0, currency)}
          className="income"
        />
        <Figure
          label={t('dashboard.expense')}
          value={formatMoney(current?.expense ?? 0, currency)}
          note={
            current?.savingsRate != null
              ? t('dashboard.savingsRate', { percent: Math.round(current.savingsRate * 100) })
              : undefined
          }
          className="expense"
        />
        <Card withBorder radius="md" padding="md" component={Link} to="/budget" className={classes.link}>
          <Text size="xs" c="dimmed" fw={500}>
            {t('budget.readyToAssign')}
          </Text>
          <Text
            className={`num ${(summary.data?.readyToAssign ?? 0) < 0 ? 'expense' : ''}`}
            fz={22}
            fw={600}
            mt={4}
          >
            {formatMoney(summary.data?.readyToAssign ?? 0, currency)}
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            {t('dashboard.toEnvelopes')}
          </Text>
        </Card>
      </SimpleGrid>

      {differences.length > 0 && (
        <Alert color="yellow" variant="light" icon={<TriangleAlert size={18} />}>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">
              {t('dashboard.monobankDifference', {
                names: differences
                  .map(
                    (link) =>
                      `${link.accountName ?? link.title} ${formatMoney(link.difference ?? 0, link.currency ?? currency, { signed: true })}`,
                  )
                  .join(', '),
              })}
            </Text>
            <Button size="xs" variant="default" onClick={() => void navigate('/accounts')}>
              {t('nav.accounts')}
            </Button>
          </Group>
        </Alert>
      )}

      <div className={classes.columns}>
        <Stack gap="md">
          <Card withBorder radius="md" padding="lg">
            <Group justify="space-between" mb="md">
              <Text fw={600}>{t('reports.tabs.spending')}</Text>
              <Anchor component={Link} to="/reports" size="sm">
                {t('dashboard.allReports')}
              </Anchor>
            </Group>
            {spending.isLoading ? (
              <Skeleton height={200} />
            ) : (spending.data?.categories ?? []).length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('reports.empty')}
              </Text>
            ) : (
              <Stack gap="sm">
                {(spending.data?.categories ?? []).slice(0, 6).map((row) => {
                  const info = categoriesById.get(row.categoryId!);
                  return (
                    <Group key={row.categoryId} gap="sm" wrap="nowrap">
                      <CategoryIcon icon={info?.icon} color={info?.color} size={28} />
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" truncate>
                            {row.name}
                          </Text>
                          <Text size="sm" className="num" fw={500}>
                            {formatMoney(row.amount ?? 0, spending.data?.currency ?? currency)}
                          </Text>
                        </Group>
                        <ShareBar
                          share={row.share ?? 0}
                          color={`var(--mantine-color-${mantineColor(info?.color)}-filled)`}
                        />
                      </Stack>
                    </Group>
                  );
                })}
              </Stack>
            )}
          </Card>

          <Card withBorder radius="md" padding="lg">
            <Text fw={600} mb="md">
              {t('dashboard.sixMonths')}
            </Text>
            {monthly.isLoading ? (
              <Skeleton height={220} />
            ) : (
              <BarChart
                h={220}
                data={previousMonths.map((item) => ({
                  month: monthName(item.month),
                  [t('reports.income')]: item.income ?? 0,
                  [t('reports.expense')]: item.expense ?? 0,
                }))}
                dataKey="month"
                series={[
                  { name: t('reports.income'), color: 'green.6' },
                  { name: t('reports.expense'), color: 'red.6' },
                ]}
                withLegend
                valueFormatter={(value) => formatMoney(value, currency)}
                gridAxis="y"
                tickLine="none"
              />
            )}
          </Card>
        </Stack>

        <Stack gap="md">
          <Card withBorder radius="md" padding="lg">
            <Group justify="space-between" mb="md">
              <Text fw={600}>{t('nav.budget')}</Text>
              <Anchor component={Link} to="/budget" size="sm">
                {t('dashboard.allEnvelopes')}
              </Anchor>
            </Group>
            {envelopes.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('dashboard.noEnvelopes')}
              </Text>
            ) : (
              <Stack gap="sm">
                {envelopes.map((row) => {
                  const share = spentShare(row);
                  const available = row.available ?? 0;
                  return (
                    <Stack key={row.categoryId} gap={4}>
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" truncate>
                          {row.name}
                        </Text>
                        <Text size="sm" className={`num ${available < 0 ? 'expense' : ''}`} fw={500}>
                          {formatMoney(available, budget.data?.currency ?? currency)}
                        </Text>
                      </Group>
                      <div className={classes.pace}>
                        <ShareBar share={share} color={available < 0 ? 'var(--ww-expense)' : undefined} />
                        <i style={{ left: `${progress * 100}%` }} />
                      </div>
                    </Stack>
                  );
                })}
                <Text size="xs" c="dimmed">
                  {t('dashboard.paceHint')}
                </Text>
              </Stack>
            )}
          </Card>

          <Card withBorder radius="md" padding={0}>
            <Group justify="space-between" p="lg" pb="sm">
              <Text fw={600}>{t('dashboard.recent')}</Text>
              <Anchor component={Link} to="/transactions" size="sm">
                {t('dashboard.allTransactions')}
              </Anchor>
            </Group>
            {(recent.data?.items ?? []).map((transaction) => {
              const info = displayCategory(transaction, categoriesById);
              const amount = signedAmount(transaction);
              const transfer = transaction.type === 'TRANSFER';
              return (
                <Group
                  key={transaction.id}
                  px="lg"
                  py="xs"
                  gap="sm"
                  wrap="nowrap"
                  className={classes.recent}
                  onClick={() => void navigate(`/transactions?edit=${transaction.id}`)}
                >
                  <CategoryIcon icon={info?.icon} color={info?.color} transfer={transfer} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>
                      {transaction.payee?.name ??
                        (transfer ? t('transactions.types.TRANSFER') : t('transactions.noPayee'))}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {info?.path ?? (transfer ? '' : t('transactions.uncategorized'))}
                    </Text>
                  </div>
                  <Text
                    size="sm"
                    fw={500}
                    className={`num ${transfer ? 'muted' : amount < 0 ? 'expense' : 'income'}`}
                  >
                    {formatMoney(amount, transaction.currency ?? currency, { signed: !transfer })}
                  </Text>
                </Group>
              );
            })}
          </Card>
        </Stack>
      </div>
    </Stack>
  );
}
