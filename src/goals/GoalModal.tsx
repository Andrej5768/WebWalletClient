import { Group, Modal, Select, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, toProblem } from '../api/errors';
import { check } from '../api/http';
import { queryKeys, useAccounts } from '../api/queries';
import { confirmDelete } from '../components/confirm';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { MoneyInput } from '../components/MoneyInput';
import { RadioTiles } from '../components/RadioTiles';
import { CATEGORY_ICONS } from '../lib/categoryIcons';
import { currencyOptions } from '../lib/currencies';
import { formatMoney } from '../lib/money';
import { mantineColor, type PaletteColor } from '../lib/palette';
import { ColorSwatches } from '../settings/ColorSwatches';
import { requestOf, useDeleteGoal, type Goal, type GoalRequest } from './api';
import { selectableAccounts } from '../lib/accounts';

/** Icons offered for goals: things people save for. */
const GOAL_ICONS = [
  'piggy-bank',
  'plane',
  'shield',
  'laptop',
  'house',
  'car',
  'gift',
  'graduation-cap',
  'smartphone',
  'sofa',
  'baby',
  'heart',
  'bed',
  'briefcase',
  'landmark',
  'wallet',
];

const FIELDS = ['name', 'targetAmount', 'currency', 'targetDate', 'accountId', 'saved', 'icon', 'color'];

/** Creates or edits a goal: target, deadline, the account that holds the money (or none), icon, color. */
export function GoalModal({
  goal,
  baseCurrency,
  onClose,
}: {
  goal: Goal | null;
  baseCurrency: string;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState<number | ''>(goal?.targetAmount ?? '');
  const [currency, setCurrency] = useState(goal?.currency ?? baseCurrency);
  const [date, setDate] = useState<string | null>(goal?.targetDate ?? null);
  const [accountId, setAccountId] = useState<string>(goal?.accountId != null ? String(goal.accountId) : '');
  const [saved, setSaved] = useState<number | ''>(goal && goal.accountId == null ? goal.saved : '');
  const [icon, setIcon] = useState(goal?.icon ?? 'piggy-bank');
  const [color, setColor] = useState<PaletteColor | null>(goal?.color ?? 'blue');

  const options = [
    { value: '', label: t('goals.form.noAccount') },
    ...selectableAccounts(accounts.data ?? [], [accountId]).map((account) => ({
      value: String(account.id),
      label: `${account.name} · ${formatMoney(account.balance, account.currency)}`,
    })),
  ];

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const changes: Partial<GoalRequest> = {
        name: name.trim(),
        targetAmount: Number(target),
        currency,
        targetDate: date ?? undefined,
        accountId: accountId ? Number(accountId) : undefined,
        saved: accountId ? undefined : Number(saved || 0),
        icon,
        color: color ?? undefined,
      };
      return check(
        goal
          ? api.PUT('/api/v1/goals/{id}', {
              params: { path: { id: goal.id } },
              body: requestOf(goal, changes),
            })
          : api.POST('/api/v1/goals', { body: changes as GoalRequest }),
      );
    },
    onSuccess: done,
    meta: { errorShown: true },
  });
  const remove = useDeleteGoal({ onDeleted: onClose, errorShown: true });
  const errors = save.error ? fieldErrors(toProblem(save.error)) : {};

  const chooseAccount = (value: string | null) => {
    const id = value ?? '';
    setAccountId(id);
    // Money on an account is in its currency, so the target usually is too.
    const account = accounts.data?.find((item) => String(item.id) === id);
    if (account) setCurrency(account.currency);
  };

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      title={<Text fw={600}>{t(goal ? 'goals.form.editTitle' : 'goals.form.newTitle')}</Text>}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Stack gap="md">
          <TextInput
            label={t('goals.form.name')}
            withAsterisk
            data-autofocus
            value={name}
            error={errors.name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Group grow align="flex-start">
            <MoneyInput
              label={t('goals.form.target')}
              withAsterisk
              currency={currency}
              value={target}
              error={errors.targetAmount}
              onChange={(value) => setTarget(typeof value === 'number' ? value : '')}
            />
            <Select
              label={t('goals.form.currency')}
              data={currencyOptions(currency)}
              value={currency}
              searchable
              allowDeselect={false}
              error={errors.currency}
              onChange={(value) => value && setCurrency(value)}
            />
          </Group>
          <DateInput
            label={t('goals.form.date')}
            description={t('goals.form.dateHint')}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            valueFormat="DD.MM.YYYY"
            clearable
            value={date}
            error={errors.targetDate}
            onChange={(value) => setDate(value ? String(value) : null)}
          />
          <Select
            label={t('goals.form.account')}
            description={t(accountId ? 'goals.form.accountHint' : 'goals.form.manualHint')}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            data={options}
            value={accountId}
            allowDeselect={false}
            error={errors.accountId}
            onChange={chooseAccount}
          />
          {!accountId && (
            <MoneyInput
              label={t('goals.form.saved')}
              currency={currency}
              value={saved}
              error={errors.saved}
              onChange={(value) => setSaved(typeof value === 'number' ? value : '')}
            />
          )}
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t('goals.form.icon')}
            </Text>
            <RadioTiles
              label={t('goals.form.icon')}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(36px, 1fr))' }}
              value={icon}
              onChange={setIcon}
              options={GOAL_ICONS.map((name) => {
                const Icon = CATEGORY_ICONS[name]!;
                return {
                  value: name,
                  label: name,
                  render: (selected: boolean) => (
                    <ThemeIcon
                      size={36}
                      radius="md"
                      variant={selected ? 'light' : 'transparent'}
                      color={selected ? mantineColor(color, 'cobalt') : 'gray'}
                    >
                      <Icon size={18} />
                    </ThemeIcon>
                  ),
                };
              })}
            />
          </Stack>
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t('goals.form.color')}
            </Text>
            <ColorSwatches value={color} onChange={setColor} />
          </Stack>
          <ProblemAlert error={save.error ?? remove.error} fieldsShown={FIELDS} />
          <FormFooter
            onCancel={onClose}
            onDelete={
              goal
                ? () =>
                    confirmDelete({
                      title: t('goals.deleteTitle', { name: goal.name }),
                      text: t('goals.deleteText'),
                      onConfirm: () => remove.mutate(goal.id),
                    })
                : undefined
            }
            deleting={remove.isPending}
            saving={save.isPending}
            submitDisabled={!name.trim() || !target}
          />
        </Stack>
      </form>
    </Modal>
  );
}
