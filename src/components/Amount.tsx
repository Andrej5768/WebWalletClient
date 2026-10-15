import { Text, type TextProps } from '@mantine/core';
import { formatMoney } from '../lib/money';

/**
 * A money amount colored by meaning: expenses red with "−", income green with "+", neutral values
 * (transfers, balances) without a sign unless negative.
 */
export function Amount({
  value,
  currency,
  kind = 'auto',
  ...props
}: TextProps & { value: number; currency: string; kind?: 'auto' | 'neutral' | 'signed' }) {
  const signed = kind === 'signed';
  const color = kind === 'neutral' ? 'muted' : value < 0 ? 'expense' : signed && value > 0 ? 'income' : '';
  return (
    <Text component="span" fw={500} {...props} className={`num ${color} ${props.className ?? ''}`}>
      {formatMoney(value, currency, { signed })}
    </Text>
  );
}
