import { Card, Group, Stack, Text } from '@mantine/core';
import type dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ShareBar } from '../components/Figure';
import { formatMonthTitle } from '../lib/format';
import { formatMoney } from '../lib/money';
import { kyivToday } from '../lib/periods';
import { monthProgress, spentShare, type BudgetRow, type MonthBudget } from './model';
import classes from './monthList.module.css';
import { PlanInput } from './PlanTable';

type IncomeRow = MonthBudget['incomeCategories'][number];

/** One line of a section: a category's own values, or a category without subcategories. */
interface Line {
  categoryId: number;
  name: string;
  planned: number;
  actual: number;
  /** Expenses only: what is left of the plan. */
  left?: number;
}

/** The lines of a group: its own values when it has them, then its subcategories. */
function linesOf<T extends { categoryId: number; name: string; children: T[] }>(
  row: T,
  own: (row: T) => Line,
  hasOwn: (row: T) => boolean,
): Line[] {
  if (!row.children.length) return [own(row)];
  return [...(hasOwn(row) ? [own(row)] : []), ...row.children.map(own)];
}

const expenseLine = (row: BudgetRow, ownOnly: boolean): Line => ({
  categoryId: row.categoryId,
  name: row.name,
  planned: ownOnly ? row.ownAssigned : row.assigned,
  actual: -(ownOnly ? row.ownActivity : row.activity),
  left: ownOnly ? row.ownAvailable : row.available,
});

const incomeLine = (row: IncomeRow, ownOnly: boolean): Line => ({
  categoryId: row.categoryId,
  name: row.name,
  planned: ownOnly ? row.ownPlanned : row.planned,
  actual: ownOnly ? row.ownReceived : row.received,
});

/**
 * The budget of one month as a list, for a phone, where a table of 25 months does not fit: income received against
 * its plan, then every expense category with what is left, a bar of the spending and the plan to type in. The same
 * screen the Android app shows.
 */
export function MonthList({
  budget,
  month,
  editable,
  onAssign,
}: {
  budget: MonthBudget;
  month: dayjs.Dayjs;
  /** A past month is read-only here; its plan is changed on a wider screen. */
  editable: boolean;
  onAssign(categoryId: number, assigned: number): void;
}) {
  const { t } = useTranslation();
  const money = (value: number) => formatMoney(value, budget.currency);
  const today = monthProgress(month, kyivToday());
  const monthName = formatMonthTitle(month);

  const plan = (line: Line) =>
    editable ? (
      <span className={classes.plan}>
        <PlanInput
          value={line.planned}
          label={t('budget.plan.planOf', { name: line.name, month: monthName })}
          onSave={(value) => onAssign(line.categoryId, value)}
        />
      </span>
    ) : (
      <span className="num">{line.planned ? money(line.planned) : '—'}</span>
    );

  const incomeRow = (line: Line, nested: boolean) => (
    <div key={`income-${line.categoryId}`} className={`${classes.row} ${nested ? classes.nested : ''}`}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm" fw={500} truncate>
          {line.name}
        </Text>
        <Text size="sm" fw={600} className="num income">
          {money(line.actual)}
        </Text>
      </Group>
      {line.planned > 0 && <ShareBar share={line.actual / line.planned} color="var(--ww-income)" />}
      <Group justify="space-between" wrap="nowrap" gap="sm" className={classes.meta}>
        <Text size="xs" c="dimmed">
          {t('budget.assigned')}
        </Text>
        {plan(line)}
      </Group>
    </div>
  );

  const expenseRow = (line: Line, nested: boolean) => {
    const left = line.left ?? 0;
    return (
      <div key={`expense-${line.categoryId}`} className={`${classes.row} ${nested ? classes.nested : ''}`}>
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm" fw={500} truncate>
            {line.name}
          </Text>
          <Text size="sm" fw={600} className={`num ${left < 0 ? 'expense' : ''}`}>
            {money(left)}
          </Text>
        </Group>
        {(line.planned > 0 || line.actual > 0) && (
          <ShareBar
            share={spentShare({ activity: -line.actual, available: left })}
            color={left < 0 ? 'var(--ww-expense)' : undefined}
            marker={today}
          />
        )}
        <Group justify="space-between" wrap="nowrap" gap="sm" className={classes.meta}>
          <Text size="xs" c="dimmed" className="num">
            {t('budget.month.spent', { amount: money(line.actual) })}
          </Text>
          {plan(line)}
        </Group>
      </div>
    );
  };

  const groupHead = (name: string, value: string, tone = '') => (
    <Group justify="space-between" wrap="nowrap" gap="sm" className={classes.group}>
      <Text size="sm" fw={600} truncate>
        {name}
      </Text>
      <Text size="sm" fw={600} className={`num ${tone}`}>
        {value}
      </Text>
    </Group>
  );

  const incomeRows = budget.incomeCategories.filter((row) => !row.archived || row.received || row.planned);
  const expenseRows = budget.categories.filter((row) => !row.archived || row.activity || row.assigned);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding={0}>
        <div className={classes.section}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {t('budget.plan.income')}
          </Text>
          <Text size="xs" c="dimmed" className="num">
            {t('budget.month.incomeOfPlan', {
              income: money(budget.income),
              plan: money(budget.plannedIncome),
            })}
          </Text>
        </div>
        {incomeRows.map((row) =>
          row.children.length ? (
            <div key={`income-group-${row.categoryId}`}>
              {groupHead(row.name, money(row.received), 'income')}
              {linesOf(
                row,
                (item) => incomeLine(item, true),
                (item) => Boolean(item.ownPlanned || item.ownReceived),
              ).map((line) => incomeRow(line, true))}
            </div>
          ) : (
            incomeRow(incomeLine(row, false), false)
          ),
        )}
        {budget.uncategorizedIncome > 0 && (
          <div className={classes.row}>
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm" fw={500}>
                {t('budget.plan.uncategorized')}
              </Text>
              <Text size="sm" fw={600} className="num income">
                {money(budget.uncategorizedIncome)}
              </Text>
            </Group>
          </div>
        )}
      </Card>

      <Card withBorder radius="md" padding={0}>
        <div className={classes.section}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {t('budget.plan.expenses')}
          </Text>
          <Text size="xs" c="dimmed" className="num">
            {t('budget.month.leftOfPlan', { left: money(budget.available), plan: money(budget.assigned) })}
          </Text>
        </div>
        {expenseRows.map((row) =>
          row.children.length ? (
            <div key={`expense-group-${row.categoryId}`}>
              {groupHead(row.name, money(row.available), row.available < 0 ? 'expense' : '')}
              {linesOf(
                row,
                (item) => expenseLine(item, true),
                (item) => Boolean(item.ownAssigned || item.ownActivity),
              ).map((line) => expenseRow(line, true))}
            </div>
          ) : (
            expenseRow(expenseLine(row, false), false)
          ),
        )}
      </Card>
    </Stack>
  );
}
