import { accountOf } from '../test/fixtures';
import { selectableAccounts } from './accounts';

const accounts = [
  accountOf({ id: 1, name: 'Готівка', operations: 12 }),
  accountOf({ id: 2, name: 'Чорна картка', operations: 340 }),
  accountOf({ id: 3, name: 'Біла картка', operations: 12 }),
  accountOf({ id: 4, name: 'Стара картка', operations: 900, archived: true }),
];

describe('selectableAccounts', () => {
  it('puts the most used accounts first and leaves archived ones out', () => {
    expect(selectableAccounts(accounts).map((account) => account.name)).toEqual([
      'Чорна картка',
      'Біла картка',
      'Готівка',
    ]);
  });

  it('keeps the archived account of the thing being edited, last', () => {
    expect(selectableAccounts(accounts, ['4', null]).map((account) => account.id)).toEqual([2, 3, 1, 4]);
  });
});
