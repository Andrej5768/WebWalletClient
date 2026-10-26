import { Text, TextInput, type TextInputProps } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluate, isExpression } from '../lib/arithmetic';
import { formatQuantity } from '../lib/money';

// Plain spaces between the thousands: easier to edit than the non-breaking ones of the locale
const format = (amount: number) => formatQuantity(amount, 2).replace(/[\u00a0\u202f]/g, ' ');

interface Props extends Omit<TextInputProps, 'value' | 'onChange'> {
  /** The amount, or '' for none. */
  value?: number | string;
  onChange: (value: number | string) => void;
  /** Currency code shown inside the input. */
  currency?: string;
}

/**
 * Amount field that also takes arithmetic: `1200*0.8`, `350+120`, `1200-15%`. The result is computed as the
 * user types and is what the form gets; the text becomes the result when the field is left.
 */
export function AmountInput({
  value = '',
  onChange,
  currency,
  onFocus,
  onBlur,
  classNames,
  ...props
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === '' ? '' : format(Number(value)));
  const result = draft !== null && isExpression(draft) ? evaluate(draft) : null;

  return (
    <TextInput
      inputMode="decimal"
      autoComplete="off"
      inputWrapperOrder={['label', 'input', 'description', 'error']}
      value={shown}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        onChange(evaluate(text) ?? '');
      }}
      onFocus={(event) => {
        setDraft(value === '' ? '' : format(Number(value)));
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        // Enter settles the expression without submitting the form
        if (event.key === 'Enter' && draft !== null && isExpression(draft)) {
          event.preventDefault();
          setDraft(result === null ? draft : format(result));
        }
      }}
      classNames={{
        ...(classNames as object),
        input: `num ${(classNames as { input?: string })?.input ?? ''}`,
      }}
      rightSection={
        currency ? (
          <Text size="xs" ff="monospace" c="dimmed">
            {currency}
          </Text>
        ) : undefined
      }
      rightSectionWidth={currency ? 48 : undefined}
      description={
        draft !== null && isExpression(draft)
          ? result === null
            ? t('transactions.form.expressionIncomplete')
            : `= ${format(result)}`
          : undefined
      }
      {...props}
    />
  );
}
