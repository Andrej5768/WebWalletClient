import dayjs from 'dayjs';
import { linesOf, missesPlan, planRange, tenseOf, type PlanRow } from './plan';

const months = ['2026-09', '2026-10'];

function rowOf(overrides: Partial<PlanRow> & { categoryId: number; name: string }): PlanRow {
  return {
    parentId: null,
    archived: false,
    carryOver: false,
    average: 0,
    ownAverage: 0,
    months: months.map((month) => ({ month, plan: 0, actual: 0, ownPlan: 0, ownActual: 0 })),
    children: [],
    ...overrides,
  };
}

it('spans twelve months back and twelve ahead of the current one', () => {
  expect(planRange(dayjs('2026-10-28'))).toEqual({ from: '2025-10', to: '2027-10', current: '2026-10' });
});

it('tells past, current and future months apart', () => {
  expect(['2026-09', '2026-10', '2026-11'].map((month) => tenseOf(month, '2026-10'))).toEqual([
    'past',
    'current',
    'future',
  ]);
});

describe('linesOf', () => {
  const groceries = rowOf({
    categoryId: 2,
    name: 'Продукти',
    parentId: 1,
    ownAverage: 60,
    months: months.map((month) => ({ month, plan: 300, actual: 100, ownPlan: 300, ownActual: 100 })),
  });

  it('turns a category without subcategories into one editable line with its own values', () => {
    const [line] = linesOf([rowOf({ categoryId: 5, name: 'Таксі', ownAverage: 40 })], 'expense');
    expect(line).toMatchObject({ categoryId: 5, group: false, nested: false, average: 40 });
  });

  it('heads a group with its totals and lists its own line only when it has values', () => {
    const food = rowOf({
      categoryId: 1,
      name: 'Їжа',
      average: 60,
      months: months.map((month) => ({ month, plan: 300, actual: 100, ownPlan: 0, ownActual: 0 })),
      children: [groceries],
    });
    expect(linesOf([food], 'expense').map((line) => [line.name, line.group, line.nested])).toEqual([
      ['Їжа', true, false],
      ['Продукти', false, true],
    ]);
    expect(linesOf([food], 'expense')[0]!.cells[0]).toEqual({ plan: 300, actual: 100 });

    const funded = { ...food, months: food.months.map((cell) => ({ ...cell, plan: 350, ownPlan: 50 })) };
    expect(linesOf([funded], 'expense').map((line) => [line.key, line.cells[0]!.plan])).toEqual([
      ['group-1', 350],
      ['1', 50],
      ['2', 300],
    ]);
  });
});

describe('missesPlan', () => {
  it('marks spending above the plan in any month that has started', () => {
    expect(missesPlan('expense', 100, 120, 'past')).toBe(true);
    expect(missesPlan('expense', 100, 120, 'current')).toBe(true);
    expect(missesPlan('expense', 100, 80, 'past')).toBe(false);
  });

  it('marks income below the plan only once the month is over', () => {
    expect(missesPlan('income', 1000, 800, 'past')).toBe(true);
    expect(missesPlan('income', 1000, 800, 'current')).toBe(false);
    expect(missesPlan('income', 0, 0, 'past')).toBe(false);
  });

  it('never marks a future month', () => {
    expect(missesPlan('expense', 0, 50, 'future')).toBe(false);
  });
});
