import { flattenCategories } from './categories';
import { autoColor } from './palette';

it('gives a category without a color a stable one that is not gray', () => {
  expect(autoColor(7)).toBe(autoColor(7));
  expect(new Set([1, 2, 3, 4, 5].map(autoColor)).size).toBe(5);
  expect([...Array(30).keys()].map(autoColor)).not.toContain('slate');
});

it('keeps chosen colors and lets subcategories take the color of the group', () => {
  const [food, cafe, fun] = flattenCategories([
    { id: 1, name: 'Їжа', kind: 'EXPENSE', children: [{ id: 2, name: 'Кафе', kind: 'EXPENSE' }] },
    { id: 3, name: 'Розваги', kind: 'EXPENSE', color: 'pink' },
  ]);

  expect(food!.color).toBe(autoColor(1));
  expect(food!.own.color).toBeNull();
  expect(cafe!.color).toBe(food!.color);
  expect(fun!.color).toBe('pink');
});
