import {
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { fieldErrors, toProblem } from '../api/errors';
import { check } from '../api/http';
import { invalidateCategories } from '../api/queries';
import { required } from '../lib/validation';
import { CategoryIcon } from '../components/CategoryIcon';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { RadioTiles } from '../components/RadioTiles';
import { CATEGORY_ICON_NAMES, CATEGORY_ICONS } from '../lib/categoryIcons';
import type { CategoryInfo } from '../lib/categories';
import { mantineColor, type PaletteColor } from '../lib/palette';
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
      icon: existing?.own.icon ?? null,
      color: existing?.own.color ?? null,
      // A subcategory without its own flag shows "same as group"; a new group starts as a need.
      necessity: (existing?.own.necessity ??
        (existing?.parentId || draft.parentId ? 'INHERIT' : 'NEEDS')) as Necessity,
      archived: existing?.own.archived ?? false,
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
      await check(
        existing
          ? api.PUT('/api/v1/categories/{id}', { params: { path: { id: existing.id } }, body })
          : api.POST('/api/v1/categories', { body }),
      );
    },
    onSuccess: async () => {
      await invalidateCategories(queryClient);
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
            <RadioTiles
              label={t('settings.categories.icon')}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))' }}
              value={values.icon}
              // Clicking the chosen icon again clears it, so a subcategory falls back to its group's.
              onChange={(icon) => form.setFieldValue('icon', icon === values.icon ? null : icon)}
              options={CATEGORY_ICON_NAMES.map((name) => {
                const Icon = CATEGORY_ICONS[name]!;
                return {
                  value: name as string | null,
                  label: name,
                  render: (selected: boolean) => (
                    <ThemeIcon
                      size={36}
                      radius="md"
                      variant={selected ? 'light' : 'transparent'}
                      color={selected ? mantineColor(shownColor, 'cobalt') : 'gray'}
                    >
                      <Icon size={18} />
                    </ThemeIcon>
                  ),
                };
              })}
            />
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
          <ProblemAlert error={save.error} fieldsShown={['name']} />
          <FormFooter onCancel={onClose} saving={save.isPending} />
        </Stack>
      </form>
    </Modal>
  );
}
