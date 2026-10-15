import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronLeft, ChevronRight, CopyPlus, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { toProblem, problemMessage } from '../api/errors';
import { useCategories } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { locale } from '../i18n';
import type { CategoryInfo } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { assign, useBudget } from './api';
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
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const month = parseMonth(params.get('month'));
  const key = monthKey(month);
  const budget = useBudget(key);
  const previous = useBudget(monthKey(month.subtract(1, 'month')));
  const categories = useCategories();
  const [moving, setMoving] = useState<{ from?: number; to?: number } | null>(null);

  const categoriesById = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );
  const currency = budget.data?.currency ?? 'UAH';
  const progress = monthProgress(month);
  const rows = budget.data?.categories ?? [];
  const groups = groupEnvelopes(rows);
  const overspent = flatEnvelopes(rows).filter((row) => (row.available ?? 0) < 0);
  const ready = budget.data?.readyToAssign ?? 0;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['budget'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] }),
    ]);

  const update = useMutation({
    mutationFn: ({ categoryId, assigned }: { categoryId: number; assigned: number }) =>
      assign(key, categoryId, assigned),
    onSettled: refresh,
  });

  const copyPrevious = useMutation({
    mutationFn: async () => {
      const before = new Map(
        flatEnvelopes(previous.data?.categories ?? []).map((row) => [row.categoryId, row]),
      );
      const empty = flatEnvelopes(rows).filter((row) => !row.assigned);
      for (const row of empty) {
        const last = before.get(row.categoryId)?.assigned ?? 0;
        if (last > 0) await assign(key, row.categoryId!, last);
      }
    },
    onSettled: refresh,
  });

  const go = (offset: number) => {
    const next = new URLSearchParams(params);
    next.set('month', monthKey(month.add(offset, 'month')));
    setParams(next, { replace: true });
  };

  const monthTitle = month
    .toDate()
    .toLocaleDateString(locale(i18n.language), { month: 'long', year: 'numeric' });
  const problem = update.error ?? copyPrevious.error;

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
            <Text fw={500} miw={140} ta="center" tt="capitalize">
              {monthTitle}
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
            loading={copyPrevious.isPending}
            onClick={() => copyPrevious.mutate()}
          >
            {t('budget.copyPrevious')}
          </Button>
          <Button leftSection={<ArrowLeftRight size={16} />} onClick={() => setMoving({})}>
            {t('budget.move')}
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Stack gap={2}>
            <Text size="sm" c="dimmed" fw={500}>
              {t('budget.readyToAssign')}
            </Text>
            <Text className={`num ${ready < 0 ? 'expense' : 'income'}`} fz={32} fw={600} lh={1.1}>
              {formatMoney(ready, currency)}
            </Text>
          </Stack>
          <Text size="sm" c="dimmed" maw={460}>
            {t(ready < 0 ? 'budget.readyNegative' : ready > 0 ? 'budget.readyPositive' : 'budget.readyZero')}
          </Text>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Figure label={t('budget.assigned')} value={budget.data?.assigned} currency={currency} />
        <Figure label={t('budget.spent')} value={-(budget.data?.activity ?? 0)} currency={currency} />
        <Figure label={t('budget.available')} value={budget.data?.available} currency={currency} />
      </SimpleGrid>

      {budget.data?.unconvertedCurrencies?.length ? (
        <Alert color="yellow" variant="light" icon={<TriangleAlert size={18} />}>
          {t('budget.unconverted', { currencies: budget.data.unconvertedCurrencies.join(', ') })}
        </Alert>
      ) : null}
      {overspent.length > 0 && (
        <Alert color="red" variant="light" icon={<TriangleAlert size={18} />}>
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">
              {t('budget.overspent', {
                names: overspent
                  .map((row) => `${row.name} ${formatMoney(row.available ?? 0, currency)}`)
                  .join(', '),
              })}
            </Text>
            <Button size="xs" variant="default" onClick={() => setMoving({ to: overspent[0]?.categoryId })}>
              {t('budget.cover')}
            </Button>
          </Group>
        </Alert>
      )}
      {problem && (
        <Alert color="yellow" variant="light" role="alert">
          {problemMessage(toProblem(problem))}
        </Alert>
      )}

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
            <div key={group.head.categoryId}>
              <div className={`${classes.row} ${classes.group}`}>
                <span>{group.head.name}</span>
                <span className={`num ${classes.right}`}>{formatMoney(group.assigned, currency)}</span>
                <span className={`num ${classes.right}`}>{formatMoney(group.spent, currency)}</span>
                <span className={`num ${classes.right}`}>{formatMoney(group.available, currency)}</span>
              </div>
              {[group.head, ...group.envelopes]
                .filter((row, index) => index > 0 || group.envelopes.length === 0 || hasMoney(row))
                .map((row) => (
                  <EnvelopeRow
                    key={`${row.categoryId}-${row.assigned}`}
                    envelope={row}
                    category={categoriesById.get(row.categoryId!)}
                    currency={currency}
                    progress={progress}
                    onAssign={(assigned) => update.mutate({ categoryId: row.categoryId!, assigned })}
                  />
                ))}
            </div>
          ))}
        </div>
      </Card>

      {moving && (
        <MoveMoneyModal
          month={key}
          envelopes={flatEnvelopes(rows)}
          currency={currency}
          initial={moving}
          onClose={() => setMoving(null)}
          onMoved={refresh}
        />
      )}
    </Stack>
  );
}

const hasMoney = (row: Envelope) => !!row.assigned || !!row.activity || !!row.available;

function Figure({ label, value, currency }: { label: string; value?: number; currency: string }) {
  return (
    <Card withBorder radius="md" padding="md">
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
      <Text className="num" fz={20} fw={600} mt={4}>
        {value === undefined ? '—' : formatMoney(value, currency)}
      </Text>
    </Card>
  );
}

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
  const [draft, setDraft] = useState<number | string>(envelope.assigned ?? 0);
  const share = spentShare(envelope);
  const available = envelope.available ?? 0;
  const ahead = progress !== null && share > progress + 0.1 && available >= 0;

  const commit = () => {
    const value = draft === '' ? 0 : Number(draft);
    if (value !== (envelope.assigned ?? 0)) onAssign(value);
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
                {t('budget.ahead', { percent: Math.round((share - progress!) * 100) })}
              </Text>
            )}
          </Group>
          <div className={classes.bar} aria-hidden>
            <span
              style={{
                width: `${Math.min(share, 1) * 100}%`,
                background: available < 0 ? 'var(--ww-expense)' : 'var(--mantine-primary-color-filled)',
              }}
            />
            {progress !== null && (
              <Tooltip label={t('budget.today')} withArrow>
                <i className={classes.today} style={{ left: `${progress * 100}%` }} />
              </Tooltip>
            )}
          </div>
        </div>
      </Group>
      <NumberInput
        size="xs"
        aria-label={t('budget.assignTo', { name: envelope.name })}
        value={draft}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
        decimalScale={2}
        thousandSeparator=" "
        decimalSeparator=","
        hideControls
        classNames={{ input: `num ${classes.amount}` }}
      />
      <Text size="sm" className={`num ${classes.right}`}>
        {formatMoney(-(envelope.activity ?? 0), currency)}
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
