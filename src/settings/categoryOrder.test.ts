import type { CategoryInfo } from '../lib/categories';
import { moveCategory, type OrderItem } from './categoryOrder';

const item = (id: number, parentId: number | null): CategoryInfo => ({
  own: { icon: null, color: null, necessity: null, archived: false },
  id,
  name: String(id),
  path: String(id),
  kind: 'EXPENSE',
  icon: null,
  color: null,
  parentId,
  archived: false,
  necessity: null,
});

// Food (1): groceries (11), cafe (12); Transport (2): taxi (21), bus (22)
const items = [item(1, null), item(11, 1), item(12, 1), item(2, null), item(21, 2), item(22, 2)];

const shape = (order: OrderItem[] | null) =>
  order?.map(({ id, parentId }) => (parentId === null ? `${id}` : `${parentId}>${id}`)).join(' ');

describe('moveCategory', () => {
  it('reorders subcategories inside a group', () => {
    expect(shape(moveCategory(items, 11, 12))).toBe('1 1>12 1>11 2 2>21 2>22');
  });

  it('moves a subcategory into another group', () => {
    expect(shape(moveCategory(items, 12, 22))).toBe('1 1>11 2 2>21 2>22 2>12');
    expect(shape(moveCategory(items, 22, 11))).toBe('1 1>22 1>11 1>12 2 2>21');
  });

  it('moves a subcategory dropped on a group header below it to the top of that group', () => {
    expect(shape(moveCategory(items, 11, 2))).toBe('1 1>12 2 2>11 2>21 2>22');
  });

  it('moves a group with its subcategories', () => {
    expect(shape(moveCategory(items, 2, 1))).toBe('2 2>21 2>22 1 1>11 1>12');
  });

  it('numbers the sort order within each parent', () => {
    expect(moveCategory(items, 2, 11)?.map((entry) => entry.sortOrder)).toEqual([0, 0, 1, 1, 0, 1]);
  });

  it('does nothing when dropped on itself', () => {
    expect(moveCategory(items, 11, 11)).toBeNull();
  });
});
