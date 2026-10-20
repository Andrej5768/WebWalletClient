import type { Schemas } from '../api/client';

export type AccountType = NonNullable<Schemas['AccountResponse']['type']>;

/** Mantine color of each account type, used for dots and icon tiles. */
const TYPE_COLORS: Record<AccountType, string> = {
  CARD: 'blue',
  CREDIT_CARD: 'red',
  CASH: 'green',
  SAVINGS: 'pink',
  DEPOSIT: 'violet',
  LOAN: 'orange',
  DEBT: 'yellow',
  INVESTMENT: 'teal',
  FOP: 'indigo',
};

export function accountColorName(type: AccountType | undefined): string {
  return type ? TYPE_COLORS[type] : 'gray';
}

/** CSS color of the account type that adapts to the color scheme. */
export function accountColor(type: AccountType | undefined): string {
  return `var(--mantine-color-${accountColorName(type)}-filled)`;
}

/** Everyday money is budgeted by default; savings, deposits, loans, debts and investments are not. */
export function inBudgetByDefault(type: AccountType): boolean {
  return type === 'CASH' || type === 'CARD' || type === 'CREDIT_CARD' || type === 'FOP';
}
