// Currencies offered first; the backend accepts any ISO 4217 code with an NBU rate.
const COMMON = [
  'UAH',
  'USD',
  'EUR',
  'PLN',
  'GBP',
  'CHF',
  'CZK',
  'CAD',
  'JPY',
  'CNY',
  'TRY',
  'GEL',
  'MDL',
  'HUF',
  'SEK',
  'NOK',
  'DKK',
  'RON',
  'BGN',
  'AUD',
];

/** Select options "UAH — Ukrainian hryvnia", keeping a current value that is not in the common list. */
export function currencyOptions(current?: string): { value: string; label: string }[] {
  const codes = current && !COMMON.includes(current) ? [...COMMON, current] : COMMON;
  const names = new Intl.DisplayNames([document.documentElement.lang || 'uk'], { type: 'currency' });
  return codes.map((code) => ({ value: code, label: `${code} — ${names.of(code) ?? code}` }));
}

interface Converted {
  currency: string;
  balance: number;
  balanceInBase: number | null;
}

/**
 * Today's rates to the base currency as the accounts show them (balance in base / balance), per currency; a currency
 * of the base itself is 1. Accounts with a zero balance or without a rate say nothing about it.
 */
export function ratesFromAccounts(accounts: Converted[], baseCurrency: string): Map<string, number> {
  const rates = new Map<string, number>([[baseCurrency, 1]]);
  for (const account of accounts) {
    if (!rates.has(account.currency) && account.balance !== 0 && account.balanceInBase != null) {
      rates.set(account.currency, account.balanceInBase / account.balance);
    }
  }
  return rates;
}
