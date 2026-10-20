import { Badge, Checkbox, Select, Stack, Switch, Table, TagsInput, Text } from '@mantine/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../api/client';
import { Amount } from '../components/Amount';
import { categorySelectData, type CategoryInfo } from '../lib/categories';
import { formatDate, formatDayShort, formatPercent } from '../lib/format';
import { formatMoney } from '../lib/money';
import type { PreviewOperation } from './api';
import {
  allowedTypes,
  canPair,
  isUncategorized,
  needsTransferAccount,
  pairOf,
  samePair,
  type Pair,
  type RowEdit,
  type Suggestion,
} from './edits';

const warn = { input: { borderColor: 'var(--ww-warn-border)', background: 'var(--ww-warn-bg)' } };

/** One previewed operation with what can be changed before the import. */
export function PreviewRow({
  operation,
  edit,
  selected,
  categories,
  accounts,
  tagNames,
  showErrors,
  onSelect,
  onChange,
  onPair,
}: {
  operation: PreviewOperation;
  edit: RowEdit;
  selected: boolean;
  categories: CategoryInfo[];
  accounts: Schemas['AccountResponse'][];
  tagNames: string[];
  /** Highlights a transfer without its other account, after a confirm was tried. */
  showErrors: boolean;
  onSelect(selected: boolean): void;
  onChange(patch: Partial<RowEdit>): void;
  /** Chooses the other half of a transfer, or none. */
  onPair(pair: Pair | null): void;
}) {
  const { t } = useTranslation();
  const name = operation.payee ?? operation.comment ?? operation.key;
  const duplicate = operation.duplicate;
  const signed = operation.type === 'EXPENSE' ? -operation.amount : operation.amount;
  const transferChoices = accounts.filter(
    (account) => account.currency === operation.currency && account.id !== operation.account.id,
  );
  const missingTransfer = needsTransferAccount(operation, edit);
  const suggestions = operation.transferSuggestions ?? [];
  const pairing = canPair(operation, edit);
  const pairIndex = edit.pair
    ? suggestions.findIndex((suggestion) => samePair(pairOf(suggestion), edit.pair))
    : -1;

  return (
    <Table.Tr
      data-testid={`preview-row-${operation.key}`}
      style={{ opacity: edit.include && !duplicate ? 1 : 0.5 }}
    >
      <Table.Td>
        <Checkbox
          aria-label={t('imports.preview.select', { name })}
          disabled={duplicate}
          checked={selected}
          onChange={(event) => onSelect(event.currentTarget.checked)}
        />
      </Table.Td>
      <Table.Td>
        <Stack gap={4}>
          {/* A duplicate is already in the ledger and is never imported again. */}
          <Switch
            size="xs"
            aria-label={t('imports.preview.include', { name })}
            disabled={duplicate}
            checked={edit.include && !duplicate}
            onChange={(event) => onChange({ include: event.currentTarget.checked })}
          />
          {duplicate && (
            <Badge size="xs" variant="light" color="gray">
              {t('imports.preview.duplicate')}
            </Badge>
          )}
        </Stack>
      </Table.Td>
      <Table.Td maw={260}>
        <Text size="sm" fw={500} truncate>
          {operation.payee ?? operation.comment ?? '—'}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {formatDate(operation.date)} · {operation.account.name}
          {operation.account.created ? ` (${t('imports.preview.new')})` : ''}
          {operation.toAccount ? ` → ${operation.toAccount.name}` : ''}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Amount
          size="sm"
          value={signed}
          currency={operation.currency}
          kind={operation.type === 'TRANSFER' ? 'neutral' : 'signed'}
        />
      </Table.Td>
      <Table.Td w={150}>
        <Stack gap={4}>
          <Select
            size="xs"
            allowDeselect={false}
            disabled={duplicate}
            aria-label={t('imports.preview.typeOf', { name })}
            data={allowedTypes(operation.type).map((value) => ({
              value,
              label: t(`transactions.form.types.${value}`),
            }))}
            value={edit.type}
            onChange={(value) => value && onChange({ type: value as RowEdit['type'] })}
          />
          {edit.type === 'TRANSFER' && operation.type !== 'TRANSFER' && (
            <Select
              size="xs"
              placeholder={t('imports.preview.transferAccount')}
              aria-label={t('imports.preview.transferAccount')}
              data={transferChoices.map((account) => ({ value: String(account.id), label: account.name }))}
              value={edit.transferAccountId}
              onChange={(value) => onChange({ transferAccountId: value })}
              error={showErrors && missingTransfer ? t('imports.preview.transferRequired') : undefined}
            />
          )}
        </Stack>
      </Table.Td>
      <Table.Td w={240}>
        {edit.type === 'TRANSFER' ? (
          <Text size="xs" c="dimmed">
            —
          </Text>
        ) : (
          <Stack gap={4}>
            {pairing && (
              <Checkbox
                size="xs"
                label={t('imports.preview.pairWith')}
                aria-label={t('imports.preview.pairWithOf', { name })}
                checked={!!edit.pair}
                onChange={(event) => onPair(event.currentTarget.checked ? pairOf(suggestions[0]!) : null)}
              />
            )}
            {pairing && edit.pair ? (
              <Select
                size="xs"
                allowDeselect={false}
                aria-label={t('imports.preview.pairOperation')}
                data={suggestions.map((suggestion, index) => ({
                  value: String(index),
                  label: suggestionLabel(suggestion, operation.type === 'EXPENSE', t),
                }))}
                value={pairIndex >= 0 ? String(pairIndex) : null}
                onChange={(value) => value != null && onPair(pairOf(suggestions[Number(value)]!))}
              />
            ) : (
              <CategoryPicker
                operation={operation}
                edit={edit}
                duplicate={duplicate}
                name={name}
                categories={categories}
                onChange={onChange}
              />
            )}
          </Stack>
        )}
      </Table.Td>
      <Table.Td w={180}>
        <TagsInput
          size="xs"
          disabled={duplicate}
          aria-label={t('imports.preview.tagsOf', { name })}
          placeholder={edit.tags.length ? '' : t('imports.preview.addTag')}
          data={tagNames}
          value={edit.tags}
          onChange={(value) => onChange({ tags: value })}
        />
      </Table.Td>
    </Table.Tr>
  );
}

/** "Monobank · +5 000,00 ₴ · 20 жовт. · уже в обліку · та сама сума". */
function suggestionLabel(suggestion: Suggestion, outgoing: boolean, t: TFunction): string {
  const amount = formatMoney(outgoing ? suggestion.amount : -suggestion.amount, suggestion.currency, {
    signed: true,
  });
  const source = t(
    suggestion.transactionId != null ? 'imports.preview.pairInLedger' : 'imports.preview.pairInFile',
  );
  const difference = suggestion.exact
    ? t('imports.preview.pairExact')
    : t(suggestion.difference < 0 ? 'imports.preview.pairLess' : 'imports.preview.pairMore', {
        percent: formatPercent(Math.abs(suggestion.difference)),
      });
  return [suggestion.accountName, amount, formatDayShort(suggestion.date), source, difference].join(' · ');
}

function CategoryPicker({
  operation,
  edit,
  duplicate,
  name,
  categories,
  onChange,
}: {
  operation: PreviewOperation;
  edit: RowEdit;
  duplicate: boolean;
  name: string;
  categories: CategoryInfo[];
  onChange(patch: Partial<RowEdit>): void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Select
        size="xs"
        searchable
        clearable
        disabled={duplicate}
        aria-label={t('imports.preview.categoryOf', { name })}
        placeholder={
          !edit.categoryChanged && operation.categoryName && operation.categoryId == null
            ? t('imports.preview.newCategory', { name: operation.categoryName })
            : t('transactions.uncategorized')
        }
        data={categorySelectData(categories, edit.type === 'INCOME' ? 'INCOME' : 'EXPENSE')}
        value={edit.categoryId}
        onChange={(value) => onChange({ categoryId: value, categoryChanged: true })}
        styles={!duplicate && isUncategorized(operation, edit) ? warn : undefined}
      />
      {edit.categoryChanged && edit.categoryId && operation.payee && (
        <Checkbox
          size="xs"
          label={t('imports.preview.rememberRule')}
          checked={edit.rememberRule}
          onChange={(event) => onChange({ rememberRule: event.currentTarget.checked })}
        />
      )}
    </>
  );
}
