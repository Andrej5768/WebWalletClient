import { Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { fieldErrors, toProblem } from '../api/errors';
import { check } from '../api/http';
import { invalidateLedger } from '../api/queries';
import { confirmDelete } from '../components/confirm';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { MoneyInput } from '../components/MoneyInput';
import { inBudgetByDefault, type AccountType } from '../lib/accounts';
import { currencyOptions } from '../lib/currencies';
import { required } from '../lib/validation';
import { accountTypes, hasInterest, type Account } from './groups';

interface Values {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: number | string;
  creditLimit: number | string;
  interestRate: number | string;
  inBudget: boolean;
  archived: boolean;
}

const FORM_FIELDS = ['name', 'type', 'currency', 'openingBalance', 'creditLimit', 'interestRate'];

const toNumber = (value: number | string): number | undefined => (value === '' ? undefined : Number(value));

function initialValues(account: Account | null): Values {
  return {
    name: account?.name ?? '',
    type: account?.type ?? 'CARD',
    currency: account?.currency ?? 'UAH',
    openingBalance: account?.openingBalance ?? 0,
    creditLimit: account?.creditLimit ?? '',
    interestRate: account?.interestRate ?? '',
    inBudget: account?.inBudget ?? inBudgetByDefault('CARD'),
    archived: account?.archived ?? false,
  };
}

/** Creates an account, or edits one when `account` is given. */
export function AccountFormModal({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const editing = account !== null;
  const form = useForm<Values>({ initialValues: initialValues(account), validate: { name: required } });

  /** A new account follows the budget default of its type until the switch is touched. */
  const changeType = (type: AccountType) => {
    form.setFieldValue('type', type);
    if (!editing && !form.isTouched('inBudget')) form.setFieldValue('inBudget', inBudgetByDefault(type));
  };

  const done = async () => {
    await invalidateLedger(queryClient);
    onClose();
  };

  const save = useMutation({
    mutationFn: (values: Values) => {
      const body: Schemas['AccountRequest'] = {
        name: values.name.trim(),
        type: values.type,
        currency: values.currency,
        openingBalance: toNumber(values.openingBalance) ?? 0,
        // 0 removes a limit or a rate on update; an omitted field would keep the old value.
        creditLimit: values.type === 'CREDIT_CARD' ? (toNumber(values.creditLimit) ?? 0) : undefined,
        interestRate: hasInterest(values.type) ? (toNumber(values.interestRate) ?? 0) : undefined,
        inBudget: values.inBudget,
        archived: values.archived,
      };
      return check(
        editing
          ? api.PUT('/api/v1/accounts/{id}', { params: { path: { id: account.id } }, body })
          : api.POST('/api/v1/accounts', { body }),
      );
    },
    onSuccess: done,
    onError: (error) => form.setErrors(fieldErrors(toProblem(error))),
  });

  const remove = useMutation({
    mutationFn: () => check(api.DELETE('/api/v1/accounts/{id}', { params: { path: { id: account!.id } } })),
    onSuccess: done,
    meta: { errorShown: true },
  });

  const type = form.values.type;

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      title={<Text fw={600}>{t(editing ? 'accounts.form.editTitle' : 'accounts.form.newTitle')}</Text>}
    >
      <form onSubmit={form.onSubmit((values) => save.mutate(values))} noValidate>
        <Stack gap="md">
          <TextInput label={t('accounts.form.name')} data-autofocus {...form.getInputProps('name')} />
          <SimpleGrid cols={2} spacing="md">
            <Select
              label={t('accounts.form.type')}
              allowDeselect={false}
              data={accountTypes.map((value) => ({ value, label: t(`accounts.types.${value}`) }))}
              {...form.getInputProps('type')}
              onChange={(value) => value && changeType(value as AccountType)}
            />
            <Select
              label={t('accounts.form.currency')}
              searchable
              allowDeselect={false}
              disabled={editing}
              data={currencyOptions(form.values.currency)}
              description={editing ? t('accounts.form.currencyLocked') : undefined}
              styles={{ description: { color: 'var(--ww-expense)' } }}
              {...form.getInputProps('currency')}
            />
            <MoneyInput
              label={t('accounts.form.openingBalance')}
              min={undefined}
              currency={form.values.currency}
              {...form.getInputProps('openingBalance')}
            />
            {type === 'CREDIT_CARD' && (
              <MoneyInput
                label={t('accounts.form.creditLimit')}
                description={t('accounts.form.creditLimitHint')}
                currency={form.values.currency}
                {...form.getInputProps('creditLimit')}
              />
            )}
            {hasInterest(type) && (
              <NumberInput
                label={t('accounts.form.interestRate')}
                min={0}
                max={100}
                decimalScale={2}
                rightSection={
                  <Text size="xs" c="dimmed">
                    %
                  </Text>
                }
                {...form.getInputProps('interestRate')}
              />
            )}
          </SimpleGrid>
          <Group gap="xl">
            <Switch
              label={t('accounts.form.inBudget')}
              description={t('accounts.form.inBudgetHint')}
              {...form.getInputProps('inBudget', { type: 'checkbox' })}
            />
            <Switch
              label={t('accounts.form.archived')}
              {...form.getInputProps('archived', { type: 'checkbox' })}
            />
          </Group>
          <ProblemAlert error={save.error ?? remove.error} fieldsShown={FORM_FIELDS} />
          <FormFooter
            onCancel={onClose}
            saving={save.isPending}
            deleting={remove.isPending}
            onDelete={
              editing
                ? () =>
                    confirmDelete({
                      title: t('accounts.form.deleteTitle', { name: account.name }),
                      text: t('accounts.form.deleteText'),
                      onConfirm: () => remove.mutate(),
                    })
                : undefined
            }
          />
        </Stack>
      </form>
    </Modal>
  );
}
