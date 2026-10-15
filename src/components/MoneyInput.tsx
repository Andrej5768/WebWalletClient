import { NumberInput, Text, type NumberInputProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/**
 * Amount input with two decimals and the separators of the interface language; the currency code,
 * when given, is shown inside the input.
 */
export function MoneyInput({ currency, classNames, ...props }: NumberInputProps & { currency?: string }) {
  const { i18n } = useTranslation();
  const english = i18n.language === 'en';
  return (
    <NumberInput
      decimalScale={2}
      thousandSeparator={english ? ',' : ' '}
      decimalSeparator={english ? '.' : ','}
      min={0}
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
      {...props}
    />
  );
}
