import { ActionIcon, Alert, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronLeft, ChevronRight, CopyPlus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { ProblemAlert, QueryError, UnconvertedAlert } from '../components/feedback';
import { Figure } from '../components/Figure';
import { formatMonthTitle } from '../lib/format';
import { formatMoney } from '../lib/money';
import { assign, budgetChanged, copyPreviousMonth, useBudget } from './api';
import { MoveMoneyModal } from './MoveMoneyModal';
import { flatEnvelopes, monthKey, parseMonth } from './model';
import { assignMany, planRange, usePlan } from './plan';
import { PlanTable } from './PlanTable';

export function BudgetPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const month = parseMonth(params.get('month'));
  const key = monthKey(month);
  const budget = useBudget(key);
  const range = planRange();
  const plan = usePlan(range.from, range.to);
  const [moving, setMoving] = useState<{ from?: number; to?: number } | null>(null);

  const currency = budget.data?.currency ?? 'UAH';
  const rows = budget.data?.categories ?? [];
  const envelopes = flatEnvelopes(rows);
  const overspent = envelopes.filter((row) => row.available < 0);
  const ready = budget.data?.readyToAssign ?? 0;

  const update = useMutation({
    mutationFn: ({ month, categoryId, assigned }: { month: string; categoryId: number; assigned: number }) =>
      assign(month, categoryId, assigned),
    onSuccess: (updated) => budgetChanged(queryClient, updated),
    meta: { errorShown: true },
  });
  const updateMany = useMutation({
    mutationFn: ({ month, plans }: { month: string; plans: { categoryId: number; assigned: number }[] }) =>
      assignMany(month, plans),
    onSuccess: (updated) => budgetChanged(queryClient, updated),
    meta: { errorShown: true },
  });
  const copyPrevious = useMutation({
    mutationFn: (month: string) => copyPreviousMonth(month),
    onSuccess: (updated) => budgetChanged(queryClient, updated),
    meta: { errorShown: true },
  });

  const select = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === range.current) next.delete('month');
    else next.set('month', value);
    setParams(next, { replace: true });
  };
  const go = (offset: number) => select(monthKey(month.add(offset, 'month')));

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group gap="xs">
          <Title order={1} size="h2">
            {t('nav.budget')}
          </Title>
          <Group gap={2} ml="sm">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('budget.previousMonth')}
              onClick={() => go(-1)}
            >
              <ChevronLeft size={18} />
            </ActionIcon>
            <Text fw={500} miw={140} ta="center">
              {formatMonthTitle(month)}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('budget.nextMonth')}
              onClick={() => go(1)}
            >
              <ChevronRight size={18} />
            </ActionIcon>
            {key !== range.current && (
              <Button variant="subtle" size="xs" ml={4} onClick={() => select(range.current)}>
                {t('budget.thisMonth')}
              </Button>
            )}
          </Group>
        </Group>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<CopyPlus size={16} />}
            disabled={!budget.isSuccess}
            loading={copyPrevious.isPending}
            onClick={() => copyPrevious.mutate(key)}
          >
            {t('budget.copyPrevious')}
          </Button>
          <Button
            leftSection={<ArrowLeftRight size={16} />}
            disabled={!budget.isSuccess}
            onClick={() => setMoving({})}
          >
            {t('budget.move')}
          </Button>
        </Group>
      </Group>

      <QueryError error={budget.error} onRetry={() => void budget.refetch()} />

      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Stack gap={2}>
            <Text size="sm" c="dimmed" fw={500}>
              {t('budget.readyToAssign')}
            </Text>
            <Text className={`num ${ready < 0 ? 'expense' : 'income'}`} fz={32} fw={600} lh={1.1}>
              {budget.data ? formatMoney(ready, currency) : '—'}
            </Text>
          </Stack>
          <Text size="sm" c="dimmed" maw={460}>
            {t(ready < 0 ? 'budget.readyNegative' : ready > 0 ? 'budget.readyPositive' : 'budget.readyZero')}
          </Text>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Figure
          label={t('budget.inflow')}
          value={money(budget.data?.inflow, currency)}
          note={
            budget.data?.plannedIncome
              ? t('budget.plannedIncome', { amount: formatMoney(budget.data.plannedIncome, currency) })
              : undefined
          }
        />
        <Figure label={t('budget.assigned')} value={money(budget.data?.assigned, currency)} />
        <Figure
          label={t('budget.spent')}
          value={money(budget.data ? -budget.data.activity : undefined, currency)}
        />
        <Figure label={t('budget.available')} value={money(budget.data?.available, currency)} />
      </SimpleGrid>

      <UnconvertedAlert currencies={budget.data?.unconvertedCurrencies} />
      {overspent.length > 0 && (
        <Alert color="red" variant="light" icon={<TriangleAlert size={18} />}>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">
              {t('budget.overspent', {
                names: overspent
                  .map((row) => `${row.name} ${formatMoney(row.available, currency)}`)
                  .join(', '),
              })}
            </Text>
            <Button size="xs" variant="default" onClick={() => setMoving({ to: overspent[0]!.categoryId })}>
              {t('budget.cover')}
            </Button>
          </Group>
        </Alert>
      )}
      <ProblemAlert error={update.error ?? updateMany.error ?? copyPrevious.error ?? plan.error} />

      <PlanTable
        plan={plan.data}
        loading={plan.isLoading}
        current={range.current}
        selected={key}
        onSelect={select}
        actions={{
          assign: (month, categoryId, assigned) => update.mutate({ month, categoryId, assigned }),
          assignMany: (month, plans) => updateMany.mutate({ month, plans }),
          copyPrevious: (month) => copyPrevious.mutate(month),
        }}
      />

      {moving && (
        <MoveMoneyModal
          month={key}
          envelopes={envelopes}
          currency={currency}
          initial={moving}
          onClose={() => setMoving(null)}
        />
      )}
    </Stack>
  );
}

const money = (value: number | undefined, currency: string) =>
  value === undefined ? '—' : formatMoney(value, currency);
