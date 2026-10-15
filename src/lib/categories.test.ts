import { categoryOf } from '../test/fixtures';
import { categorySelectData, flattenCategories, type Category } from './categories';

const tree: Category[] = [
  categoryOf({
    id: 1,
    name: 'Їжа',
    icon: 'utensils',
    color: 'orange',
    necessity: 'NEEDS',
    children: [
      categoryOf({ id: 2, name: 'Продукти', parentId: 1, icon: 'shopping-cart' }),
      categoryOf({ id: 3, name: 'Кафе', parentId: 1, necessity: 'WANTS', archived: true }),
    ],
  }),
  categoryOf({ id: 4, name: 'Зарплата', kind: 'INCOME', color: 'green' }),
];

describe('flattenCategories', () => {
  const flat = flattenCategories(tree);

  it('builds paths and inherits icon, color and necessity from the group', () => {
    expect(flat.find((category) => category.id === 2)).toMatchObject({
      path: 'Їжа › Продукти',
      icon: 'shopping-cart',
      color: 'orange',
      necessity: 'NEEDS',
      parentId: 1,
    });
    expect(flat.find((category) => category.id === 3)).toMatchObject({
      icon: 'utensils',
      necessity: 'WANTS',
    });
  });

  it('builds select groups of one kind without archived categories', () => {
    expect(categorySelectData(flat, 'EXPENSE')).toEqual([
      {
        group: 'Їжа',
        items: [
          { value: '1', label: 'Їжа' },
          { value: '2', label: 'Їжа › Продукти' },
        ],
      },
    ]);
  });
});
