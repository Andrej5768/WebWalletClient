import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { fieldErrors, problemMessage, toProblem } from '../api/errors';
import { queryKeys } from '../api/queries';
import { required } from '../auth/validation';
import { CategoryIcon } from '../components/CategoryIcon';
import type { CategoryInfo } from '../lib/categories';
import { mantineColor, type PaletteColor } from '../lib/palette';
import { CATEGORY_ICONS } from './categoryIcons';
import { ColorSwatches } from './ColorSwatches';

export interface CategoryDraft {
  category?: CategoryInfo;
  kind: 'EXPENSE' | 'INCOME';
  parentId?: number;
}

type Necessity = 'INHERIT' | 'NEEDS' | 'WANTS';

/** Creates or edits a category: name, type, parent group, icon, color, needs or wants, archive. */
export function CategoryModal({
  draft,
  groups,
  hasChildren,
  onClose,
}: {
  draft: CategoryDraft;
  groups: CategoryInfo[];
  hasChildren: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const existing = draft.category;
  // The icon and color inherited from the group are shown, but only own values are stored.
  const form = useForm({
    initialValues: {
      name: existing?.name ?? '',
      kind: existing?.kind ?? draft.kind,
      parentId: existing?.parentId
        ? String(existing.parentId)
        : draft.parentId
          ? String(draft.parentId)
          : null,
      icon: existing?.icon ?? null,
      color: existing?.color ?? null,
      necessity: (existing?.necessity ??
        (existing?.parentId || draft.parentId ? 'INHERIT' : 'NEEDS')) as Necessity,
      archived: existing?.archived ?? false,
    },
    validate: { name: required },
  });
  const values = form.values;
  const parent = groups.find((group) => String(group.id) === values.parentId);
  const shownColor = values.color ?? parent?.color ?? null;

  const save = useMutation({
    mutationFn: async (input: typeof values) => {
      const body: Schemas['CategoryRequest'] = {
        name: input.name.trim(),
        kind: input.kind,
        parentId: input.parentId ? Number(input.parentId) : undefined,
        // Explicit nulls clear a value on update.
        icon: input.icon as string,
        color: input.color as PaletteColor,
        necessity:
          input.kind === 'INCOME' || input.necessity === 'INHERIT'
            ? (null as unknown as 'NEEDS')
            : input.necessity,
        archived: input.archived,
      };
      const { error } = existing
        ? await api.PUT('/api/v1/categories/{id}', { params: { path: { id: existing.id } }, body })
        : await api.POST('/api/v1/categories', { body });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      onClose();
    },
    onError: (error) => form.setErrors(fieldErrors(toProblem(error))),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      title={
        <Text fw={600}>{t(existing ? 'settings.categories.editTitle' : 'settings.categories.newTitle')}</Text>
      }
    >
      <form onSubmit={form.onSubmit((input) => save.mutate(input))} noValidate>
        <Stack gap="md">
          <Group align="flex-end" gap="md" wrap="nowrap">
            <CategoryIcon icon={values.icon ?? parent?.icon} color={shownColor} size={40} />
            <TextInput
              style={{ flex: 1 }}
              label={t('settings.name')}
              withAsterisk
              data-autofocus
              {...form.getInputProps('name')}
            />
          </Group>
          <SimpleGrid cols={2} spacing="md">
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                {t('settings.categories.kind')}
              </Text>
              <SegmentedControl
                disabled={!!values.parentId}
                data={[
                  { value: 'EXPENSE', label: t('settings.categories.expenseOne') },
                  { value: 'INCOME', label: t('settings.categories.incomeOne') },
                ]}
                {...form.getInputProps('kind')}
              />
            </Stack>
            <Select
              label={t('settings.categories.parent')}
              placeholder={t('settings.categories.noParent')}
              clearable
              disabled={hasChildren}
              description={hasChildren ? t('settings.categories.parentLocked') : undefined}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              data={groups
                .filter((group) => group.kind === values.kind && group.id !== existing?.id)
                .map((group) => ({ value: String(group.id), label: group.name }))}
              {...form.getInputProps('parentId')}
            />
          </SimpleGrid>

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t('settings.categories.icon')}
            </Text>
            <div
              role="radiogroup"
              aria-label={t('settings.categories.icon')}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 6 }}
            >
              {CATEGORY_ICONS.map((name) => (
                <Tooltip key={name} label={name} withArrow openDelay={500}>
                  <ActionIcon
                    role="radio"
                    aria-checked={values.icon === name}
                    aria-label={name}
                    size={36}
                    variant={values.icon === name ? 'light' : 'subtle'}
                    color={values.icon === name ? mantineColor(shownColor, 'cobalt') : 'gray'}
                    onClick={() => form.setFieldValue('icon', values.icon === name ? null : name)}
                  >
                    <DynamicIcon name={name as IconName} size={18} />
                  </ActionIcon>
                </Tooltip>
              ))}
            </div>
            {values.parentId && !values.icon && (
              <Text size="xs" c="dimmed">
                {t('settings.categories.inheritsIcon')}
              </Text>
            )}
          </Stack>

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t('settings.color')}
            </Text>
            <ColorSwatches
              value={values.color}
              onChange={(color) => form.setFieldValue('color', color)}
              allowNone={!!values.parentId}
            />
          </Stack>

          {values.kind === 'EXPENSE' && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                {t('settings.categories.necessityLabel')}
              </Text>
              <SegmentedControl
                data={[
                  ...(values.parentId
                    ? [{ value: 'INHERIT', label: t('settings.categories.necessity.INHERIT') }]
                    : []),
                  { value: 'NEEDS', label: t('settings.categories.necessity.NEEDS') },
                  { value: 'WANTS', label: t('settings.categories.necessity.WANTS') },
                ]}
                {...form.getInputProps('necessity')}
              />
              <Text size="xs" c="dimmed">
                {t('settings.categories.necessityHelp')}
              </Text>
            </Stack>
          )}

          <Switch
            label={t('settings.categories.archivedSwitch')}
            description={t('settings.categories.archivedHelp')}
            {...form.getInputProps('archived', { type: 'checkbox' })}
          />
          {save.error && !toProblem(save.error).errors?.length && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              {problemMessage(toProblem(save.error))}
            </Alert>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
