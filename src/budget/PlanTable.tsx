import { ActionIcon, Button, Group, Menu, Modal, Skeleton, Text, Tooltip } from '@mantine/core';
import dayjs from 'dayjs';
import { Lock, MoreHorizontal, Repeat } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { locale } from '../i18n';
import { evaluate } from '../lib/arithmetic';
import { formatQuantity } from '../lib/money';
import {
  linesOf,
  missesPlan,
  tenseOf,
  type BudgetPlan,
  type Line,
  type MonthTense,
  type PlanTotals,
} from './plan';
import classes from './planTable.module.css';

export interface PlanActions {
  assign(month: string, categoryId: number, assigned: number): void;
  assignMany(month: string, plans: { categoryId: number; assigned: number }[]): void;
  copyPrevious(month: string): void;
}

const whole = (value: number) => formatQuantity(Math.round(value), 0);
const signedWhole = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '') + whole(Math.abs(value));
// Plain spaces between the thousands: easier to edit than the non-breaking ones of the locale
const editable = (value: number) => formatQuantity(value, 2).replace(/[\u00a0\u202f]/g, ' ');

function monthLabel(month: string) {
  const date = dayjs(`${month}-01`).toDate();
  return {
    short: new Intl.DateTimeFormat(locale(), { month: 'short' }).format(date).replace('.', ''),
    long: new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(date),
    year: date.getFullYear(),
  };
}

/**
 * Plan and actual values of the budget over many months. Past months and the current one have a plan and an actual
 * column, future months only a plan. Plans of past months are read-only until the month is opened for editing from
 * its menu: the plan of a past month is what its actual values are compared with.
 */
export function PlanTable({
  plan,
  loading,
  current,
  selected,
  onSelect,
  actions,
}: {
  plan?: BudgetPlan;
  loading: boolean;
  current: string;
  selected: string;
  onSelect(month: string): void;
  actions: PlanActions;
}) {
  const { t } = useTranslation();
  const sheet = useRef<HTMLDivElement>(null);
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(new Set());
  const [clearing, setClearing] = useState<string | null>(null);
  const months = plan?.months ?? [];
  const selectedIndex = months.indexOf(selected);

  const tense = (month: string) => tenseOf(month, current);
  const canEdit = (month: string) => tense(month) !== 'past' || unlocked.has(month);
  const columns = (month: string) => (tense(month) === 'future' ? 1 : 2);
  const tone = (month: string) =>
    [
      month === selected ? classes.selected : tense(month) === 'current' ? classes.current : '',
      tense(month) === 'future' && month !== selected ? classes.future : '',
    ].join(' ');

  // Opens on the current month with one month before it in view.
  const scrolled = useRef(false);
  useLayoutEffect(() => {
    if (scrolled.current || !plan || !sheet.current) return;
    scrolled.current = true;
    scrollTo(sheet.current, dayjs(`${current}-01`).subtract(1, 'month').format('YYYY-MM'), false);
  }, [plan, current]);
  // A month chosen with the arrows above the table comes into view.
  useEffect(() => {
    if (sheet.current && scrolled.current) scrollTo(sheet.current, selected, true);
  }, [selected]);

  if (loading || !plan) return <Skeleton height={420} radius="md" />;

  const income = linesOf(plan.income, 'income');
  const expenses = linesOf(plan.expenses, 'expense');
  const leaves = [...income, ...expenses].filter((line) => !line.group);
  const averageMonths = plan.averageMonths.map((month) => monthLabel(month).long).join(', ');

  const fillWithAverage = (month: string) => {
    const index = months.indexOf(month);
    const plans = leaves
      .filter((line) => line.cells[index]!.plan === 0 && Math.round(line.average) > 0)
      .map((line) => ({ categoryId: line.categoryId, assigned: Math.round(line.average) }));
    if (plans.length > 0) actions.assignMany(month, plans);
  };
  const clear = (month: string) => {
    const index = months.indexOf(month);
    const plans = leaves
      .filter((line) => line.cells[index]!.plan !== 0)
      .map((line) => ({ categoryId: line.categoryId, assigned: 0 }));
    if (plans.length > 0) actions.assignMany(month, plans);
  };
  const lock = (month: string, locked: boolean) =>
    setUnlocked((previous) => {
      const next = new Set(previous);
      if (locked) next.delete(month);
      else next.add(month);
      return next;
    });

  const sectionRow = (title: string) => (
    <tr className={classes.section}>
      <th colSpan={2}>{title}</th>
      {months.map((month) =>
        Array.from({ length: columns(month) }, (_, i) => (
          <td
            key={`${month}-${i}`}
            className={`${tone(month)} ${i === columns(month) - 1 ? classes.monthEnd : ''}`}
          />
        )),
      )}
    </tr>
  );

  const lineRow = (line: Line) => (
    <tr key={line.key} className={`${line.group ? classes.group : ''} ${line.nested ? classes.nested : ''}`}>
      <td className={classes.name}>
        <span className={classes.label}>
          <span title={line.name}>{line.name}</span>
          {line.carryOver && (
            <Tooltip label={t('budget.plan.carryOver')}>
              <Repeat size={12} aria-label={t('budget.plan.carryOver')} color="var(--ww-faint)" />
            </Tooltip>
          )}
        </span>
      </td>
      <td className={`num ${classes.average}`}>
        {whole(line.average)}
        {!line.group && canEdit(selected) && selectedIndex >= 0 && Math.round(line.average) > 0 && (
          <button
            type="button"
            className={classes.take}
            onClick={() => actions.assign(selected, line.categoryId, Math.round(line.average))}
          >
            {t('budget.plan.takeAverage', { month: monthLabel(selected).short })}
          </button>
        )}
      </td>
      {months.map((month, index) => {
        const cell = line.cells[index]!;
        const when = tense(month);
        const miss = missesPlan(line.kind, cell.plan, cell.actual, when);
        return [
          <td
            key={`${month}-plan`}
            className={`num ${classes.cell} ${tone(month)} ${when === 'future' ? classes.monthEnd : ''}`}
          >
            {line.group || !canEdit(month) ? (
              <span className={line.group ? undefined : classes.locked}>
                {cell.plan ? whole(cell.plan) : '—'}
              </span>
            ) : (
              <PlanInput
                value={cell.plan}
                label={t('budget.plan.planOf', { name: line.name, month: monthLabel(month).long })}
                onSave={(value) => actions.assign(month, line.categoryId, value)}
              />
            )}
          </td>,
          when !== 'future' && (
            <td
              key={`${month}-actual`}
              className={`num ${classes.cell} ${tone(month)} ${classes.monthEnd} ${miss ? classes.miss : ''}`}
            >
              {cell.actual ? whole(cell.actual) : '—'}
            </td>
          ),
        ];
      })}
    </tr>
  );

  const uncategorizedRow = (kind: Line['kind']) => {
    const pick = (totals: PlanTotals) =>
      kind === 'income' ? totals.uncategorizedIncome : totals.uncategorizedExpenses;
    if (!plan.totals.some((totals) => pick(totals) !== 0)) return null;
    return (
      <tr key={`uncategorized-${kind}`}>
        <td className={classes.name}>
          <span className={classes.label}>
            <span>{t('budget.plan.uncategorized')}</span>
          </span>
        </td>
        <td className={classes.average} />
        {months.map((month, index) => [
          <td
            key={`${month}-plan`}
            className={`${classes.cell} ${tone(month)} ${tense(month) === 'future' ? classes.monthEnd : ''}`}
          />,
          tense(month) !== 'future' && (
            <td key={`${month}-actual`} className={`num ${classes.cell} ${tone(month)} ${classes.monthEnd}`}>
              {pick(plan.totals[index]!) ? whole(pick(plan.totals[index]!)) : '—'}
            </td>
          ),
        ])}
      </tr>
    );
  };

  const totalRow = (
    label: string,
    kind: Line['kind'] | 'net',
    planned: (totals: PlanTotals) => number,
    actual: (totals: PlanTotals) => number,
    average?: number,
  ) => (
    <tr className={kind === 'net' ? classes.net : classes.total}>
      <td className={classes.name}>{label}</td>
      <td className={`num ${classes.average}`}>{average === undefined ? '' : whole(average)}</td>
      {months.map((month, index) => {
        const totals = plan.totals[index]!;
        const when = tense(month);
        const plannedValue = planned(totals);
        const actualValue = actual(totals);
        // Income above the plan and spending below it are good; for the net, more is better
        const difference = kind === 'expense' ? plannedValue - actualValue : actualValue - plannedValue;
        const bad = kind === 'net' ? actualValue < 0 : missesPlan(kind, plannedValue, actualValue, when);
        return [
          <td
            key={`${month}-plan`}
            className={`num ${classes.cell} ${tone(month)} ${when === 'future' ? classes.monthEnd : ''}`}
          >
            {kind === 'net' ? signedWhole(plannedValue) : whole(plannedValue)}
          </td>,
          when !== 'future' && (
            <td key={`${month}-actual`} className={`num ${classes.cell} ${tone(month)} ${classes.monthEnd}`}>
              <span className={bad ? classes.miss : undefined}>
                {kind === 'net' ? signedWhole(actualValue) : whole(actualValue)}
              </span>
              {plannedValue !== 0 && Math.round(difference) !== 0 && (
                <span
                  className={classes.deviation}
                  style={{ color: difference < 0 ? 'var(--ww-expense)' : 'var(--ww-income)' }}
                  title={t('budget.plan.deviation')}
                >
                  {signedWhole(difference)}
                </span>
              )}
            </td>
          ),
        ];
      })}
    </tr>
  );

  const sum = (lines: Line[]) =>
    lines.filter((line) => !line.group).reduce((total, line) => total + line.average, 0);

  return (
    <>
      <div className={classes.sheet} ref={sheet}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.name} rowSpan={2}>
                {t('budget.columns.category')}
              </th>
              <th
                className={classes.average}
                rowSpan={2}
                title={t('budget.plan.averageOf', { months: averageMonths })}
              >
                {t('budget.plan.average')}
              </th>
              {months.map((month) => (
                <MonthHead
                  key={month}
                  month={month}
                  tense={tense(month)}
                  className={`${tone(month)} ${classes.monthEnd}`}
                  colSpan={columns(month)}
                  locked={!canEdit(month)}
                  unlocked={unlocked.has(month)}
                  onSelect={() => onSelect(month)}
                  onCopyPrevious={() => actions.copyPrevious(month)}
                  onFillAverage={() => fillWithAverage(month)}
                  onClear={() => setClearing(month)}
                  onLock={(locked) => lock(month, locked)}
                />
              ))}
            </tr>
            <tr>
              {months.map((month) =>
                tense(month) === 'future' ? (
                  <th key={month} className={`${tone(month)} ${classes.monthEnd}`}>
                    {t('budget.plan.plan')}
                  </th>
                ) : (
                  [
                    <th key={`${month}-plan`} className={tone(month)}>
                      {t('budget.plan.plan')}
                    </th>,
                    <th key={`${month}-actual`} className={`${tone(month)} ${classes.monthEnd}`}>
                      {t('budget.plan.actual')}
                    </th>,
                  ]
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sectionRow(t('budget.plan.income'))}
            {income.map(lineRow)}
            {uncategorizedRow('income')}
            {totalRow(
              t('budget.plan.incomeTotal'),
              'income',
              (totals) => totals.plannedIncome,
              (totals) => totals.income,
              sum(income),
            )}
            {sectionRow(t('budget.plan.expenses'))}
            {expenses.map(lineRow)}
            {uncategorizedRow('expense')}
            {totalRow(
              t('budget.plan.expensesTotal'),
              'expense',
              (totals) => totals.plannedExpenses,
              (totals) => totals.expenses,
              sum(expenses),
            )}
            {totalRow(
              t('budget.plan.net'),
              'net',
              (totals) => totals.plannedIncome - totals.plannedExpenses,
              (totals) => totals.income - totals.expenses,
            )}
          </tbody>
        </table>
      </div>
      <Modal
        opened={clearing !== null}
        onClose={() => setClearing(null)}
        title={clearing ? t('budget.plan.clearTitle', { month: monthLabel(clearing).long }) : ''}
        centered
      >
        <Text size="sm">{t('budget.plan.clearText')}</Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setClearing(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            onClick={() => {
              if (clearing) clear(clearing);
              setClearing(null);
            }}
          >
            {t('budget.plan.clearConfirm')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}

function MonthHead({
  month,
  tense,
  className,
  colSpan,
  locked,
  unlocked,
  onSelect,
  onCopyPrevious,
  onFillAverage,
  onClear,
  onLock,
}: {
  month: string;
  tense: MonthTense;
  className: string;
  colSpan: number;
  locked: boolean;
  unlocked: boolean;
  onSelect(): void;
  onCopyPrevious(): void;
  onFillAverage(): void;
  onClear(): void;
  onLock(locked: boolean): void;
}) {
  const { t } = useTranslation();
  const label = monthLabel(month);
  return (
    <th
      className={`${className} ${tense === 'current' ? classes.current : ''}`}
      colSpan={colSpan}
      data-month={month}
    >
      <div className={classes.monthHead}>
        <button
          type="button"
          className={classes.monthTitle}
          onClick={onSelect}
          title={t('budget.plan.select')}
        >
          <b>{label.short}</b>
          <span className={classes.year}>{label.year}</span>
          {locked && <Lock size={11} aria-label={t('budget.plan.locked')} color="var(--ww-faint)" />}
        </button>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t('budget.plan.monthActions', { month: label.long })}
            >
              <MoreHorizontal size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{label.long}</Menu.Label>
            <Menu.Item onClick={onSelect}>{t('budget.plan.select')}</Menu.Item>
            {locked ? (
              <Menu.Item onClick={() => onLock(false)}>{t('budget.plan.unlock')}</Menu.Item>
            ) : (
              <>
                <Menu.Item onClick={onCopyPrevious}>{t('budget.copyPrevious')}</Menu.Item>
                <Menu.Item onClick={onFillAverage}>{t('budget.plan.fillAverage')}</Menu.Item>
                <Menu.Item color="red" onClick={onClear}>
                  {t('budget.plan.clear')}
                </Menu.Item>
                {unlocked && <Menu.Item onClick={() => onLock(true)}>{t('budget.plan.lock')}</Menu.Item>}
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </div>
    </th>
  );
}

/** A plan typed into the table: takes arithmetic like the amount fields, saved when the field is left. */
function PlanInput({ value, label, onSave }: { value: number; label: string; onSave(value: number): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = (text: string) => {
    setDraft(null);
    const next = text.trim() === '' ? 0 : evaluate(text);
    if (next !== null && Math.round(next * 100) !== Math.round(value * 100))
      onSave(Math.round(next * 100) / 100);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(null);
      // Leaving after Escape must not save what was typed
      event.currentTarget.dataset.cancel = 'true';
      event.currentTarget.blur();
    }
  };
  return (
    <input
      className={classes.planInput}
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      placeholder="—"
      value={draft ?? (value ? whole(value) : '')}
      onFocus={(event) => {
        setDraft(value ? editable(value) : '');
        event.currentTarget.select();
      }}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        const input = event.currentTarget;
        if (input.dataset.cancel) {
          delete input.dataset.cancel;
          setDraft(null);
          return;
        }
        save(draft ?? '');
      }}
    />
  );
}

/** Scrolls the table so the month's column starts right after the pinned columns. */
function scrollTo(sheet: HTMLDivElement, month: string, onlyIfHidden: boolean) {
  const head = sheet.querySelector<HTMLElement>(`th[data-month="${month}"]`);
  const pinned = sheet.querySelector<HTMLElement>('thead th:nth-child(2)');
  if (!head || !pinned) return;
  const pinnedRight = pinned.offsetLeft + pinned.offsetWidth;
  const left = head.offsetLeft - pinnedRight;
  if (onlyIfHidden) {
    const visibleFrom = sheet.scrollLeft;
    const visibleTo = sheet.scrollLeft + sheet.clientWidth - pinnedRight;
    if (left >= visibleFrom && left + head.offsetWidth <= visibleTo) return;
  }
  if (onlyIfHidden && typeof sheet.scrollTo === 'function')
    sheet.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  else sheet.scrollLeft = Math.max(0, left);
}
