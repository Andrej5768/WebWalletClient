import { SegmentedControl } from '@mantine/core';
import { useBaseCurrency } from '../api/queries';
import { currencySymbol } from '../lib/money';
import { ALTERNATIVE, useDisplayCurrency } from './useDisplayCurrency';

/** ₴ / $ switch of the investment tabs; hidden when the base currency is already the alternative. */
export function CurrencySwitch({ label }: { label: string }) {
  const base = useBaseCurrency();
  const display = useDisplayCurrency();
  if (!display.choice) return null;
  return (
    <SegmentedControl
      size="xs"
      aria-label={label}
      value={display.currency}
      onChange={display.set}
      data={[base, ALTERNATIVE].map((value) => ({ value, label: currencySymbol(value) }))}
    />
  );
}
