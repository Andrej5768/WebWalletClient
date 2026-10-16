import { locale } from '../i18n';

/** "4 200 000 ₴": an amount without kopecks, for long-term estimates where they mean nothing. */
export function wholeMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(amount);
}
