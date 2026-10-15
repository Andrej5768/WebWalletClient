import { Badge, Button, Card, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { check } from '../api/http';
import { invalidateLedger, useTags } from '../api/queries';
import { confirmDelete } from '../components/confirm';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { mantineColor, type PaletteColor } from '../lib/palette';
import { ColorSwatches } from './ColorSwatches';

type Tag = Schemas['TagResponse'];

export function TagsTab() {
  const { t } = useTranslation();
  const tags = useTags();
  const [editing, setEditing] = useState<Tag | null | undefined>(undefined);

  return (
    <Stack gap="md" maw={800}>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          {t('settings.tags.hint')}
        </Text>
        <Button leftSection={<Plus size={16} />} onClick={() => setEditing(null)}>
          {t('settings.tags.add')}
        </Button>
      </Group>
      <Card withBorder radius="md" padding="lg">
        {(tags.data ?? []).length === 0 ? (
          <Text c="dimmed" ta="center">
            {t('settings.tags.empty')}
          </Text>
        ) : (
          <Group gap="sm">
            {(tags.data ?? []).map((tag) => (
              <Badge
                key={tag.id}
                component="button"
                type="button"
                size="lg"
                radius="xl"
                variant="light"
                color={mantineColor(tag.color)}
                style={{ cursor: 'pointer', textTransform: 'none' }}
                onClick={() => setEditing(tag)}
              >
                #{tag.name}
              </Badge>
            ))}
          </Group>
        )}
      </Card>
      {editing !== undefined && <TagModal tag={editing} onClose={() => setEditing(undefined)} />}
    </Stack>
  );
}

function TagModal({ tag, onClose }: { tag: Tag | null; onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState<PaletteColor | null>(tag?.color ?? null);

  const done = async () => {
    // Tags show on transactions and filter reports, so those refresh too.
    await invalidateLedger(queryClient);
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      // An explicit null removes the color on update.
      const body = { name: name.trim(), color: color as PaletteColor };
      return check(
        tag
          ? api.PUT('/api/v1/tags/{id}', { params: { path: { id: tag.id! } }, body })
          : api.POST('/api/v1/tags', { body }),
      );
    },
    onSuccess: done,
    meta: { errorShown: true },
  });
  const remove = useMutation({
    mutationFn: () => check(api.DELETE('/api/v1/tags/{id}', { params: { path: { id: tag!.id! } } })),
    onSuccess: done,
    meta: { errorShown: true },
  });
  const problem = save.error ?? remove.error;

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={600}>{t(tag ? 'settings.tags.editTitle' : 'settings.tags.newTitle')}</Text>}
    >
      <Stack gap="md">
        <TextInput
          label={t('settings.name')}
          withAsterisk
          data-autofocus
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            {t('settings.color')}
          </Text>
          <ColorSwatches value={color} onChange={setColor} allowNone />
        </Stack>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            {t('settings.preview')}
          </Text>
          <Badge
            size="lg"
            radius="xl"
            variant="light"
            color={mantineColor(color)}
            style={{ textTransform: 'none' }}
          >
            #{name.trim() || '…'}
          </Badge>
        </Group>
        <ProblemAlert error={problem} />
        <FormFooter
          onCancel={onClose}
          onDelete={
            tag
              ? () =>
                  confirmDelete({
                    title: t('settings.tags.deleteTitle', { name: tag.name }),
                    text: t('settings.tags.deleteText'),
                    onConfirm: () => remove.mutate(),
                  })
              : undefined
          }
          deleting={remove.isPending}
          saving={save.isPending}
          submitDisabled={!name.trim()}
          onSubmit={() => save.mutate()}
        />
      </Stack>
    </Modal>
  );
}
