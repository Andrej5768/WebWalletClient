import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { fieldErrors, problemMessage, toProblem, type ApiProblem } from '../api/errors';
import { queryKeys } from '../api/queries';
import { required } from '../auth/validation';
import type { AccountType } from '../lib/accounts';
import { currencyOptions } from '../lib/currencies';
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

const toNumber = (value: number | string): number | undefined =>
  value === '' || value === undefined ? undefined : Number(value);

function initialValues(account: Account | null): Values {
  return {
    name: account?.name ?? '',
    type: account?.type ?? 'CARD',
    currency: account?.currency ?? 'UAH',
    openingBalance: account?.openingBalance ?? 0,
    creditLimit: account?.creditLimit ?? '',
    interestRate: account?.interestRate ?? '',
    inBudget: account?.inBudget ?? true,
    archived: account?.archived ?? false,
  };
}

/** Creates an account, or edits one when `account` is given. */
export function AccountFormModal({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const editing = account !== null;
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const form = useForm<Values>({ initialValues: initialValues(account), validate: { name: required } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts });

  const save = useMutation({
    mutationFn: async (values: Values) => {
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
      const { error } = editing
        ? await api.PUT('/api/v1/accounts/{id}', { params: { path: { id: account.id! } }, body })
        : await api.POST('/api/v1/accounts', { body });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError: (error) => {
      const result = toProblem(error);
      form.setErrors(fieldErrors(result));
      setProblem(result);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/api/v1/accounts/{id}', { params: { path: { id: account!.id! } } });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError: (error) => setProblem(toProblem(error)),
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
            />
            <Select
              label={t('accounts.form.currency')}
              searchable
              allowDeselect={false}
              disabled={editing}
              data={currencyOptions(form.values.currency)}
              description={editing ? t('accounts.form.currencyLocked') : undefined}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              styles={{ description: { color: 'var(--ww-expense)' } }}
              {...form.getInputProps('currency')}
            />
            <NumberInput
              label={t('accounts.form.openingBalance')}
              decimalScale={2}
              thousandSeparator=" "
              decimalSeparator=","
              rightSection={
                <Text size="xs" ff="monospace" c="dimmed">
                  {form.values.currency}
                </Text>
              }
              rightSectionWidth={52}
              {...form.getInputProps('openingBalance')}
            />
            {type === 'CREDIT_CARD' && (
              <NumberInput
                label={t('accounts.form.creditLimit')}
                description={t('accounts.form.creditLimitHint')}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                min={0}
                decimalScale={2}
                thousandSeparator=" "
                decimalSeparator=","
                {...form.getInputProps('creditLimit')}
              />
            )}
            {hasInterest(type) && (
              <NumberInput
                label={t('accounts.form.interestRate')}
                min={0}
                max={100}
                decimalScale={2}
                decimalSeparator=","
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
              {...form.getInputProps('inBudget', { type: 'checkbox' })}
            />
            <Switch
              label={t('accounts.form.archived')}
              {...form.getInputProps('archived', { type: 'checkbox' })}
            />
          </Group>
          {problem && !problem.errors?.length && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              <Text size="sm">{problemMessage(problem)}</Text>
            </Alert>
          )}
          <Group justify="space-between" pt="xs">
            {editing ? (
              <Button
                variant="outline"
                color="red"
                loading={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {t('common.delete')}
              </Button>
            ) : (
              <span />
            )}
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t('common.save')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
