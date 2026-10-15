import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { check, unwrap } from '../api/http';
import { invalidateLedger, queryKeys, useCategories, useCategoriesById, useRules } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { confirmDelete } from '../components/confirm';
import { ProblemAlert, QueryError } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { categorySelectData } from '../lib/categories';

type Rule = Schemas['RuleResponse'];

export function RulesTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const rules = useRules();
  const byId = useCategoriesById();

  const apply = useMutation({
    mutationFn: async () => (await unwrap(api.POST('/api/v1/categorization-rules/apply'))).categorized ?? 0,
    onSuccess: async (count) => {
      notifications.show({ message: t('settings.rules.applied', { count }), color: 'green' });
      // Newly categorized transactions change the budget and reports too.
      await invalidateLedger(queryClient);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) =>
      check(api.DELETE('/api/v1/categorization-rules/{id}', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rules }),
  });

  const condition = (rule: Rule) =>
    rule.payeePattern
      ? t('settings.rules.payeeContains', { value: rule.payeePattern })
      : rule.payee
        ? t('settings.rules.payeeIs', { value: rule.payee.name })
        : rule.mcc
          ? `MCC ${rule.mcc}`
          : t('settings.rules.bankCategory', { value: rule.bankCategory });

  return (
    <Stack gap="md" maw={960}>
      <Alert color="blue" variant="light" icon={<Info size={18} />}>
        {t('settings.rules.hint')}
      </Alert>
      <Group justify="flex-end" gap="sm">
        <Button
          variant="default"
          leftSection={<Sparkles size={16} />}
          loading={apply.isPending}
          onClick={() => apply.mutate()}
        >
          {t('settings.rules.apply')}
        </Button>
        <Button leftSection={<Plus size={16} />} onClick={() => setCreating(true)}>
          {t('settings.rules.add')}
        </Button>
      </Group>
      <QueryError error={rules.error} onRetry={() => void rules.refetch()} />
      <Card withBorder radius="md" p={0}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('settings.rules.condition')}</Table.Th>
              <Table.Th>{t('transactions.form.category')}</Table.Th>
              <Table.Th w={120} />
              <Table.Th w={48} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(rules.data ?? []).map((rule) => {
              const category = byId.get(rule.categoryId!);
              return (
                <Table.Tr key={rule.id}>
                  <Table.Td>{condition(rule)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <CategoryIcon icon={category?.icon} color={category?.color} size={24} />
                      <Text size="sm">{category?.path}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {rule.learned && (
                      <Badge variant="light" color="gray" size="sm">
                        {t('settings.rules.learned')}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={t('settings.rules.delete')}
                      onClick={() =>
                        confirmDelete({
                          title: t('settings.rules.deleteTitle'),
                          text: condition(rule),
                          onConfirm: () => remove.mutate(rule.id!),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        {rules.isSuccess && rules.data.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            {t('settings.rules.empty')}
          </Text>
        )}
      </Card>
      {creating && <RuleModal onClose={() => setCreating(false)} />}
    </Stack>
  );
}

function RuleModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [type, setType] = useState<'payee' | 'mcc' | 'bank'>('payee');
  const [value, setValue] = useState<string | number>('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body: Schemas['RuleRequest'] = {
        categoryId: Number(categoryId),
        payeePattern: type === 'payee' ? String(value).trim() : undefined,
        mcc: type === 'mcc' ? Number(value) : undefined,
        bankCategory: type === 'bank' ? String(value).trim() : undefined,
      };
      await check(api.POST('/api/v1/categorization-rules', { body }));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules });
      onClose();
    },
    meta: { errorShown: true },
  });

  return (
    <Modal opened onClose={onClose} title={<Text fw={600}>{t('settings.rules.newTitle')}</Text>}>
      <Stack gap="md">
        <SegmentedControl
          value={type}
          onChange={(next) => {
            setType(next as typeof type);
            setValue('');
          }}
          data={[
            { value: 'payee', label: t('settings.rules.types.payee') },
            { value: 'mcc', label: 'MCC' },
            { value: 'bank', label: t('settings.rules.types.bank') },
          ]}
        />
        {type === 'mcc' ? (
          <NumberInput label="MCC" min={0} max={9999} value={value} onChange={setValue} />
        ) : (
          <TextInput
            label={t(type === 'payee' ? 'settings.rules.payeeLabel' : 'settings.rules.bankLabel')}
            value={String(value)}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        )}
        <Select
          label={t('transactions.form.category')}
          searchable
          data={categorySelectData(categories.data ?? [])}
          value={categoryId}
          onChange={setCategoryId}
        />
        <ProblemAlert error={save.error} />
        <FormFooter
          onCancel={onClose}
          saving={save.isPending}
          submitDisabled={!categoryId || String(value).trim() === ''}
          onSubmit={() => save.mutate()}
        />
      </Stack>
    </Modal>
  );
}
