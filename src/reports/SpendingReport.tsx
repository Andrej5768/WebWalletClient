import { DonutChart } from '@mantine/charts';
import { ActionIcon, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../api/client';
import { useCategories } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import type { CategoryInfo } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { mantineColor } from '../lib/palette';
import type { Period } from '../transactions/periods';
import { useSpending } from './api';
import { ShareBar } from './Figure';
import { UnconvertedAlert } from './ReportsPage';

type Row = Schemas['CategorySpending'];

const percent = (share?: number) => `${Math.round((share ?? 0) * 1000) / 10}%`;

export function SpendingReport({ period }: { period: Period }) {
  const { t } = useTranslation();
  const report = useSpending(period);
  const categories = useCategories();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const byId = new Map((categories.data ?? []).map((category) => [category.id, category]));

  if (report.isLoading) return <Skeleton height={360} radius="md" />;
  const data = report.data;
  const currency = data?.currency ?? 'UAH';
  const rows = data?.categories ?? [];
  const total = data?.total ?? 0;

  const chart = rows
    .filter((row) => (row.amount ?? 0) > 0)
    .map((row) => ({
      name: row.name ?? '',
      value: row.amount ?? 0,
      color: `${mantineColor(byId.get(row.categoryId!)?.color)}.6`,
    }));
  if ((data?.uncategorized ?? 0) > 0) {
    chart.push({ name: t('transactions.uncategorized'), value: data!.uncategorized!, color: 'gray.4' });
  }

  const toggle = (id: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data?.unconvertedCurrencies} />
      {rows.length === 0 && !data?.uncategorized ? (
        <Card withBorder radius="md" py={48}>
          <Text ta="center" c="dimmed">
            {t('reports.empty')}
          </Text>
        </Card>
      ) : (
        <Group align="flex-start" gap="md" wrap="wrap">
          <Card withBorder radius="md" padding="lg" w={300}>
            <Stack align="center" gap="xs">
              <DonutChart
                data={chart}
                size={220}
                thickness={28}
                withTooltip
                tooltipDataSource="segment"
                valueFormatter={(value) => formatMoney(value, currency)}
                chartLabel={formatMoney(total, currency)}
                aria-label={t('reports.tabs.spending')}
              />
              <Text size="xs" c="dimmed">
                {t('reports.total')}
              </Text>
            </Stack>
          </Card>
          <Card withBorder radius="md" p={0} style={{ flex: '1 1 520px' }}>
            {rows.map((row) => (
              <CategoryRow
                key={row.categoryId}
                row={row}
                info={byId.get(row.categoryId!)}
                currency={currency}
                open={open.has(row.categoryId!)}
                onToggle={() => toggle(row.categoryId!)}
                byId={byId}
              />
            ))}
            {(data?.uncategorized ?? 0) > 0 && (
              <Group px="md" py="sm" gap="sm" style={{ borderTop: '1px solid var(--ww-border)' }}>
                <CategoryIcon size={28} />
                <Text size="sm" style={{ flex: 1 }}>
                  {t('transactions.uncategorized')}
                </Text>
                <Text size="sm" className="num" fw={500}>
                  {formatMoney(data!.uncategorized!, currency)}
                </Text>
              </Group>
            )}
            <Group px="md" py="sm" style={{ borderTop: '1px solid var(--ww-border)' }}>
              <Text fw={600} style={{ flex: 1 }}>
                {t('reports.total')}
              </Text>
              <Text className="num" fw={600}>
                {formatMoney(total, currency)}
              </Text>
            </Group>
          </Card>
        </Group>
      )}
    </Stack>
  );
}

function CategoryRow({
  row,
  info,
  currency,
  open,
  onToggle,
  byId,
}: {
  row: Row;
  info?: CategoryInfo;
  currency: string;
  open: boolean;
  onToggle(): void;
  byId: Map<number, CategoryInfo>;
}) {
  const { t } = useTranslation();
  const children = row.children ?? [];
  const color = `var(--mantine-color-${mantineColor(info?.color)}-filled)`;
  return (
    <div style={{ borderTop: '1px solid var(--ww-border)' }}>
      <Group px="md" py="sm" gap="sm" wrap="nowrap">
        {children.length > 0 ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={t(open ? 'reports.collapse' : 'reports.expand', { name: row.name })}
            aria-expanded={open}
            onClick={onToggle}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </ActionIcon>
        ) : (
          <span style={{ width: 22 }} />
        )}
        <CategoryIcon icon={info?.icon} color={info?.color} size={28} />
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={500} truncate>
              {row.name}
            </Text>
            <Text size="xs" c="dimmed" className="num">
              {percent(row.share)}
            </Text>
          </Group>
          <ShareBar share={row.share ?? 0} color={color} />
        </Stack>
        <Text size="sm" className="num" fw={500} w={130} ta="right">
          {formatMoney(row.amount ?? 0, currency)}
        </Text>
      </Group>
      {open &&
        children.map((child) => (
          <Group key={child.categoryId} pl={78} pr="md" pb="xs" gap="sm" wrap="nowrap">
            <CategoryIcon
              icon={byId.get(child.categoryId!)?.icon ?? info?.icon}
              color={info?.color}
              size={22}
            />
            <Text size="sm" c="dimmed" style={{ flex: 1 }} truncate>
              {child.name}
            </Text>
            <Text size="xs" c="dimmed" className="num">
              {percent(child.share)}
            </Text>
            <Text size="sm" className="num" w={130} ta="right">
              {formatMoney(child.amount ?? 0, currency)}
            </Text>
          </Group>
        ))}
    </div>
  );
}
