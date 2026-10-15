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
