import { ActionIcon, Anchor, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MoneyInput } from '../components/MoneyInput';
import { categorySelectData, type CategoryInfo } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { splitRemainder, type TransactionValues } from './form';

/** Parts of a split expense or income: category, amount and comment each, with the unassigned rest. */
export function SplitEditor({
  form,
  categories,
  currency,
}: {
  form: UseFormReturnType<TransactionValues>;
  categories: CategoryInfo[];
  currency: string;
}) {
  const { t } = useTranslation();
  const values = form.values;
  const remainder = splitRemainder(values);
  const kind = values.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

  return (
    <Stack gap="xs">
      {values.splits.map((_, index) => (
        <Stack key={index} gap={4}>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <Select
              style={{ flex: 1 }}
              aria-label={t('transactions.form.splitCategory')}
              searchable
              placeholder={t('transactions.uncategorized')}
              data={categorySelectData(categories, kind)}
              {...form.getInputProps(`splits.${index}.categoryId`)}
            />
            <MoneyInput
              w={130}
              aria-label={t('transactions.form.splitAmount')}
              {...form.getInputProps(`splits.${index}.amount`)}
            />
            <ActionIcon
              variant="subtle"
              color="gray"
              mt={4}
              aria-label={t('transactions.form.removeSplit')}
              disabled={values.splits.length <= 2}
              onClick={() => form.removeListItem('splits', index)}
            >
              <X size={16} />
            </ActionIcon>
          </Group>
          <TextInput
            size="xs"
            placeholder={t('transactions.form.splitComment')}
            aria-label={t('transactions.form.splitComment')}
            {...form.getInputProps(`splits.${index}.comment`)}
          />
        </Stack>
      ))}
      <Group justify="space-between">
        <Anchor
          component="button"
          type="button"
          size="sm"
          onClick={() => form.insertListItem('splits', { categoryId: null, amount: '', comment: '' })}
        >
          <Group gap={4}>
            <Plus size={14} />
            {t('transactions.form.addSplit')}
          </Group>
        </Anchor>
        <Text size="xs" className={`num ${remainder === 0 ? 'muted' : 'expense'}`}>
          {t('transactions.form.splitRemainder', { amount: formatMoney(remainder, currency) })}
        </Text>
      </Group>
    </Stack>
  );
}
