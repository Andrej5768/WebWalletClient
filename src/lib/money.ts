import { locale } from '../i18n';

export interface MoneyFormatOptions {
  /** Always show the sign, e.g. "+52 000,00 ₴" for income. */
  signed?: boolean;
  /** Language to format for; the current UI language by default. */
  language?: string;
}

/** Formats an amount in a currency with two decimals and a narrow currency symbol (₴, $, €). */
export function formatMoney(amount: number, currency: string, options: MoneyFormatOptions = {}): string {
  return new Intl.NumberFormat(locale(options.language), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  }).format(amount);
}
