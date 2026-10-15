import { Badge, Checkbox, Select, Stack, Switch, Table, TagsInput, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../api/client';
import { Amount } from '../components/Amount';
import { categorySelectData, type CategoryInfo } from '../lib/categories';
import { formatDate } from '../lib/format';
import type { PreviewOperation } from './api';
import { allowedTypes, isUncategorized, needsTransferAccount, type RowEdit } from './edits';

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
}) {
  const { t } = useTranslation();
  const name = operation.payee ?? operation.comment ?? operation.key;
  const duplicate = operation.duplicate;
  const signed = operation.type === 'EXPENSE' ? -operation.amount : operation.amount;
  const transferChoices = accounts.filter(
    (account) => account.currency === operation.currency && account.id !== operation.account.id,
  );
  const missingTransfer = needsTransferAccount(operation, edit);

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
