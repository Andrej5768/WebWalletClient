import { ActionIcon, Card, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../api/client';
import { queryKeys, usePayees } from '../api/queries';

interface Draft {
  id: number;
  name: string;
}

export function PayeesTab() {
  const { t } = useTranslation();
  const payees = usePayees();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.payees });
  const rename = useMutation({
    mutationFn: async ({ id, name }: Draft) => {
      const { error } = await api.PUT('/api/v1/payees/{id}', { params: { path: { id } }, body: { name } });
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/api/v1/payees/{id}', { params: { path: { id } } });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const submit = (draft: Draft) => {
    if (draft.name.trim()) rename.mutate({ id: draft.id, name: draft.name.trim() });
  };
  const visible = (payees.data ?? []).filter((payee) =>
    (payee.name ?? '').toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <Stack gap="md" maw={800}>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {t('settings.payees.hint')}
        </Text>
        <TextInput
          w={260}
          leftSection={<Search size={16} />}
          placeholder={t('settings.payees.filter')}
          aria-label={t('settings.payees.filter')}
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
        />
      </Group>
      <Card withBorder radius="md" p={0}>
        {visible.map((payee) => {
          const draft = editing?.id === payee.id ? editing : null;
          return (
            <Group
              key={payee.id}
              px="md"
              py="xs"
              justify="space-between"
              wrap="nowrap"
              style={{ borderTop: '1px solid var(--ww-border)' }}
            >
              {draft ? (
                <TextInput
                  size="xs"
                  style={{ flex: 1 }}
                  aria-label={t('settings.name')}
                  value={draft.name}
                  autoFocus
                  onChange={(event) => setEditing({ id: draft.id, name: event.currentTarget.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit(draft);
                    if (event.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <Text
                  size="sm"
                  component={Link}
                  to={`/transactions?payeeId=${payee.id}&period=all`}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {payee.name}
                </Text>
              )}
              <Group gap={4} wrap="nowrap">
                {draft ? (
                  <>
                    <ActionIcon variant="subtle" aria-label={t('common.save')} onClick={() => submit(draft)}>
                      <Check size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={t('common.cancel')}
                      onClick={() => setEditing(null)}
                    >
                      <X size={16} />
                    </ActionIcon>
                  </>
                ) : (
                  <>
                    <Tooltip label={t('settings.payees.rename')} withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={t('settings.payees.rename')}
                        onClick={() => setEditing({ id: payee.id!, name: payee.name ?? '' })}
                      >
                        <Pencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('settings.payees.delete')} withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={t('settings.payees.delete')}
                        onClick={() => remove.mutate(payee.id!)}
                      >
                        <Trash2 size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
              </Group>
            </Group>
          );
        })}
        {visible.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            {t('settings.payees.empty')}
          </Text>
        )}
      </Card>
    </Stack>
  );
}
