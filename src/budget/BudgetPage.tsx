import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronLeft, ChevronRight, CopyPlus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useCategoriesById } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { ProblemAlert, QueryError, UnconvertedAlert } from '../components/feedback';
import { Figure, ShareBar } from '../components/Figure';
import { MoneyInput } from '../components/MoneyInput';
import type { CategoryInfo } from '../lib/categories';
import { formatMonthTitle } from '../lib/format';
import { formatMoney } from '../lib/money';
import { assign, budgetChanged, copyPreviousMonth, useBudget } from './api';
import { MoveMoneyModal } from './MoveMoneyModal';
import {
  flatEnvelopes,
  groupEnvelopes,
  monthKey,
  monthProgress,
  parseMonth,
  spentShare,
  type Envelope,
} from './model';
import classes from './budget.module.css';

export function BudgetPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const month = parseMonth(params.get('month'));
  const key = monthKey(month);
  const budget = useBudget(key);
  const categoriesById = useCategoriesById();
  const [moving, setMoving] = useState<{ from?: number; to?: number } | null>(null);

  const currency = budget.data?.currency ?? 'UAH';
  const progress = monthProgress(month);
  const rows = budget.data?.categories ?? [];
  const groups = groupEnvelopes(rows);
  const envelopes = flatEnvelopes(rows);
  const overspent = envelopes.filter((row) => row.available < 0);
  const ready = budget.data?.readyToAssign ?? 0;

  const update = useMutation({
    mutationFn: ({ categoryId, assigned }: { categoryId: number; assigned: number }) =>
      assign(key, categoryId, assigned),
    onSuccess: (updated) => budgetChanged(queryClient, updated),
    meta: { errorShown: true },
  });
  const copyPrevious = useMutation({
    mutationFn: () => copyPreviousMonth(key),
    onSuccess: (updated) => budgetChanged(queryClient, updated),
    meta: { errorShown: true },
  });

  const go = (offset: number) => {
    const next = new URLSearchParams(params);
    next.set('month', monthKey(month.add(offset, 'month')));
    setParams(next, { replace: true });
  };

  return (
    <Stack gap="lg" maw={1200}>
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
          </Group>
        </Group>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<CopyPlus size={16} />}
            disabled={!budget.isSuccess}
            loading={copyPrevious.isPending}
            onClick={() => copyPrevious.mutate()}
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

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
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
      <ProblemAlert error={update.error ?? copyPrevious.error} />

      <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 820 }}>
          <div className={`${classes.row} ${classes.head}`}>
            <span>{t('budget.columns.category')}</span>
            <span className={classes.right}>{t('budget.assigned')}</span>
            <span className={classes.right}>{t('budget.spent')}</span>
            <span className={classes.right}>{t('budget.available')}</span>
          </div>
          {budget.isLoading && <Skeleton height={240} m="md" />}
          {groups.map((group) => (
            <div key={group.categoryId}>
              {!group.single && (
                <div className={`${classes.row} ${classes.group}`}>
                  <span>{group.name}</span>
                  <span className={`num ${classes.right}`}>{formatMoney(group.assigned, currency)}</span>
                  <span className={`num ${classes.right}`}>{formatMoney(group.spent, currency)}</span>
                  <span className={`num ${classes.right}`}>{formatMoney(group.available, currency)}</span>
                </div>
              )}
              {group.envelopes.map((row) => (
                <EnvelopeRow
                  key={row.categoryId}
                  envelope={row}
                  category={categoriesById.get(row.categoryId)}
                  currency={currency}
                  progress={progress}
                  onAssign={(assigned) => update.mutate({ categoryId: row.categoryId, assigned })}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>

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

function EnvelopeRow({
  envelope,
  category,
  currency,
  progress,
  onAssign,
}: {
  envelope: Envelope;
  category?: CategoryInfo;
  currency: string;
  progress: number | null;
  onAssign(assigned: number): void;
}) {
  const { t } = useTranslation();
  // The typed value while editing; otherwise the field shows what the server has.
  const [draft, setDraft] = useState<number | string | null>(null);
  const share = spentShare(envelope);
  const available = envelope.available;
  const ahead = progress !== null && share > progress + 0.1 && available >= 0;

  const commit = () => {
    if (draft === null) return;
    const value = draft === '' ? 0 : Number(draft);
    setDraft(null);
    if (value !== envelope.assigned) onAssign(value);
  };

  return (
    <div className={`${classes.row} ${classes.item}`}>
      <Group gap={12} wrap="nowrap">
        <CategoryIcon icon={category?.icon} color={category?.color} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap={8} justify="space-between" wrap="nowrap">
            <Text size="sm" fw={500} truncate>
              {envelope.name}
            </Text>
            {ahead && (
              <Text size="xs" c="dimmed">
                {t('budget.ahead', { percent: Math.round((share - progress) * 100) })}
              </Text>
            )}
          </Group>
          <div className={classes.barSpace}>
            <ShareBar
              share={share}
              color={available < 0 ? 'var(--ww-expense)' : undefined}
              marker={progress}
              markerTitle={t('budget.today')}
            />
          </div>
        </div>
      </Group>
      <MoneyInput
        size="xs"
        min={undefined}
        aria-label={t('budget.assignTo', { name: envelope.name })}
        value={draft ?? envelope.assigned}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
        hideControls
        classNames={{ input: classes.amount }}
      />
      <Text size="sm" className={`num ${classes.right}`}>
        {formatMoney(-envelope.activity, currency)}
      </Text>
      <div className={classes.right}>
        <Badge
          variant="light"
          color={available > 0 ? 'green' : available < 0 ? 'red' : 'gray'}
          className="num"
          size="lg"
          radius="sm"
          fw={600}
        >
          {formatMoney(available, currency)}
        </Badge>
      </div>
    </div>
  );
}
