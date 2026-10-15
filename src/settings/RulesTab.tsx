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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { problemMessage, toProblem } from '../api/errors';
import { queryKeys, useCategories } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { categorySelectData } from '../lib/categories';

type Rule = Schemas['RuleResponse'];
const rulesKey = ['categorization-rules'] as const;

export function RulesTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [creating, setCreating] = useState(false);
  const rules = useQuery({
    queryKey: rulesKey,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/categorization-rules');
      if (error || !data) throw error;
      return data;
    },
  });
  const byId = new Map((categories.data ?? []).map((category) => [category.id, category]));

  const apply = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/categorization-rules/apply');
      if (error) throw error;
      return data?.categorized ?? 0;
    },
    onSuccess: async (count) => {
      notifications.show({ message: t('settings.rules.applied', { count }), color: 'green' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/api/v1/categorization-rules/{id}', { params: { path: { id } } });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rulesKey }),
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
                      onClick={() => remove.mutate(rule.id!)}
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        {(rules.data ?? []).length === 0 && (
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
      const { error } = await api.POST('/api/v1/categorization-rules', { body });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rulesKey });
      onClose();
    },
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
        {save.error && (
          <Alert color="yellow" variant="light" p="xs" role="alert">
            {problemMessage(toProblem(save.error))}
          </Alert>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!categoryId || value === ''}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
