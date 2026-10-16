import { Badge, Group, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../api/client';
import { Amount } from '../components/Amount';
import { CategoryIcon } from '../components/CategoryIcon';
import { categorySelectData, type CategoryInfo } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { mantineColor } from '../lib/palette';
import { canQuickCategorize, isSplit, signedAmount, type Transaction } from './model';
import classes from './transactions.module.css';

interface Props {
  transaction: Transaction;
  category?: CategoryInfo;
  categories: CategoryInfo[];
  accountName?: string;
  toAccountName?: string;
  tags: Schemas['TagResponse'][];
  onOpen(): void;
  onCategorize(categoryId: number): void;
}

/** One transaction of the feed; the title opens it, an uncategorized one gets a category picker. */
export function TransactionRow({
  transaction,
  category,
  categories,
  accountName,
  toAccountName,
  tags,
  onOpen,
  onCategorize,
}: Props) {
  const { t } = useTranslation();
  const transfer = transaction.type === 'TRANSFER';
  const title = transfer
    ? `${accountName ?? ''} → ${toAccountName ?? ''}`
    : (transaction.payee?.name ?? transaction.comment ?? t('transactions.noPayee'));
  const subtitle = transfer
    ? t('transactions.types.TRANSFER')
    : isSplit(transaction)
      ? t('transactions.split', {
          names: transaction.splits
            .map((split) =>
              split.categoryId == null
                ? t('transactions.uncategorized')
                : categories.find((item) => item.id === split.categoryId)?.name,
            )
            .filter(Boolean)
            .join(', '),
        })
      : (category?.path ?? t('transactions.uncategorized'));

  return (
    // The row is clickable for the mouse; keyboard users open it with the title button.
    <div className={classes.row} onClick={onOpen} data-testid={`transaction-${transaction.id}`}>
      <CategoryIcon icon={category?.icon} color={category?.color} transfer={transfer} />
      <div style={{ minWidth: 0 }}>
        <UnstyledButton
          className={classes.title}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <Text fw={500} truncate>
            {title}
          </Text>
        </UnstyledButton>
        {canQuickCategorize(transaction) ? (
          // Clicks in the picker must not open the transaction.
          <div onClick={(event) => event.stopPropagation()}>
            <Select
              size="xs"
              w={240}
              mt={2}
              searchable
              placeholder={t('transactions.chooseCategory')}
              aria-label={t('transactions.chooseCategoryFor', { name: title })}
              data={categorySelectData(categories, transaction.type === 'INCOME' ? 'INCOME' : 'EXPENSE')}
              onChange={(value) => value && onCategorize(Number(value))}
              classNames={{ input: classes.attention }}
            />
          </div>
        ) : (
          <Group gap={6} wrap="nowrap">
            <Text size="xs" c="dimmed" truncate>
              {subtitle}
            </Text>
            {transaction.recurring && (
              <Badge
                size="xs"
                variant="light"
                style={{ textTransform: 'none', flexShrink: 0 }}
                title={transaction.recurring.name}
              >
                {t('recurring.chip')}
              </Badge>
            )}
          </Group>
        )}
      </div>
      <Stack gap={2} align="flex-start">
        <Text size="sm" c="dimmed" truncate maw="100%">
          {transfer ? '' : accountName}
        </Text>
        {tags.length > 0 && (
          <Group gap={4}>
            {tags.map((tag) => (
              <Badge key={tag.id} size="xs" variant="light" color={mantineColor(tag.color)}>
                #{tag.name}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
      <div style={{ textAlign: 'right' }}>
        <Amount
          value={signedAmount(transaction)}
          currency={transaction.currency}
          kind={transfer ? 'neutral' : 'signed'}
        />
        {transaction.originalAmount && transaction.originalCurrency ? (
          <Text size="xs" c="dimmed" className="num">
            {formatMoney(transaction.originalAmount, transaction.originalCurrency)}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
