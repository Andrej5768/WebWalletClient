import { locale } from '../i18n';

export interface MoneyFormatOptions {
  /** Always show the sign, e.g. "+52 000,00 ₴" for income. */
  signed?: boolean;
  /** Language to format for; the current UI language by default. */
  language?: string;
  /** Digits after the decimal point, 2 by default; 0 for long-term estimates where kopecks mean nothing. */
  decimals?: number;
}

/**
 * Formats an amount in a currency with a narrow currency symbol (₴, $, €). A zero is never shown with a minus sign,
 * e.g. after negating an empty sum.
 */
export function formatMoney(amount: number, currency: string, options: MoneyFormatOptions = {}): string {
  const decimals = options.decimals ?? 2;
  return new Intl.NumberFormat(locale(options.language), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  }).format(withoutNegativeZero(amount, decimals));
}

/** "150 тис. ₴" / "₴150K": a short amount for chart axes and tight spaces. */
export function formatMoneyCompact(amount: number, currency: string): string {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(withoutNegativeZero(amount, 1));
}

/** "150 тис." / "150K": a short number for chart axes. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(
    withoutNegativeZero(value, 1),
  );
}

/** "12,5" / "12.5": a quantity of units, by default with up to 4 decimals. */
export function formatQuantity(quantity: number, maxDecimals = 4): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: maxDecimals }).format(
    withoutNegativeZero(quantity, maxDecimals),
  );
}

/** "₴", "$", "€": the narrow symbol of a currency in the UI language. */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat(locale(), { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}

/** An amount that rounds to zero at the precision becomes a plain zero, so it is not shown as "−0,00". */
function withoutNegativeZero(amount: number, decimals: number): number {
  return Math.abs(amount) < 0.5 * 10 ** -decimals ? 0 : amount;
}
