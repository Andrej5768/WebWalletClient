import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, EllipsisVertical, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { problemMessage, toProblem } from '../api/errors';
import { queryKeys, useCategories } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import type { CategoryInfo } from '../lib/categories';
import { CategoryModal, type CategoryDraft } from './CategoryModal';
import { moveCategory } from './categoryOrder';

type Kind = 'EXPENSE' | 'INCOME';

export function CategoriesTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [kind, setKind] = useState<Kind>('EXPENSE');
  const [editing, setEditing] = useState<CategoryDraft | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = (categories.data ?? []).filter((category) => category.kind === kind);
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.categories });

  const reorder = useMutation({
    mutationFn: async (order: { id: number; parentId: number | null; sortOrder: number }[]) => {
      const { error } = await api.PUT('/api/v1/categories/order', {
        body: order.map((entry) => ({ ...entry, parentId: entry.parentId ?? undefined })),
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ category, archived }: { category: CategoryInfo; archived: boolean }) => {
      const { error } = await api.PUT('/api/v1/categories/{id}', {
        params: { path: { id: category.id } },
        body: {
          name: category.name,
          kind: category.kind,
          parentId: category.parentId ?? undefined,
          archived,
        },
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE('/api/v1/categories/{id}', { params: { path: { id } } });
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const order = moveCategory(items, Number(active.id), Number(over.id));
    if (order) reorder.mutate(order);
  };

  const problem = reorder.error ?? update.error ?? remove.error;

  return (
    <Stack gap="md" maw={900}>
      <Group justify="space-between" wrap="wrap">
        <SegmentedControl
          value={kind}
          onChange={(value) => setKind(value as Kind)}
          data={[
            { value: 'EXPENSE', label: t('settings.categories.expense') },
            { value: 'INCOME', label: t('settings.categories.income') },
          ]}
        />
        <Button leftSection={<Plus size={16} />} onClick={() => setEditing({ kind })}>
          {t('settings.categories.add')}
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        {t('settings.categories.dragHint')}
        {kind === 'EXPENSE' && ` ${t('settings.categories.necessityHint')}`}
      </Text>
      {problem && (
        <Alert color="yellow" variant="light" p="xs" role="alert">
          {problemMessage(toProblem(problem))}
        </Alert>
      )}
      <Card withBorder radius="md" p={0}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {items.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                hasChildren={items.some((item) => item.parentId === category.id)}
                onEdit={() => setEditing({ category, kind })}
                onAddChild={() => setEditing({ kind, parentId: category.id })}
                onArchive={() => update.mutate({ category, archived: !category.archived })}
                onDelete={() => remove.mutate(category.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Card>
      {editing && (
        <CategoryModal
          draft={editing}
          groups={items.filter((item) => item.parentId === null)}
          hasChildren={!!editing.category && items.some((item) => item.parentId === editing.category!.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </Stack>
  );
}

function CategoryRow({
  category,
  hasChildren,
  onEdit,
  onAddChild,
  onArchive,
  onDelete,
}: {
  category: CategoryInfo;
  hasChildren: boolean;
  onEdit(): void;
  onAddChild(): void;
  onArchive(): void;
  onDelete(): void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });
  const group = category.parentId === null;

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={onEdit}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        paddingLeft: group ? 16 : 52,
        borderTop: '1px solid var(--ww-border)',
        background: isDragging ? 'var(--ww-subtle)' : group ? 'var(--ww-bg)' : undefined,
        boxShadow: isDragging ? 'var(--mantine-shadow-md)' : undefined,
        position: 'relative',
        zIndex: isDragging ? 2 : undefined,
        opacity: category.archived ? 0.6 : 1,
      }}
    >
      <ActionIcon
        ref={setActivatorNodeRef}
        variant="subtle"
        color="gray"
        size="sm"
        aria-label={t('settings.categories.drag', { name: category.name })}
        style={{ cursor: 'grab' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </ActionIcon>
      <CategoryIcon icon={category.icon} color={category.color} size={group ? 32 : 28} />
      <Text fw={group ? 600 : 400} size="sm" style={{ flex: 1 }} truncate>
        {category.name}
      </Text>
      {category.archived && (
        <Badge variant="default" size="sm">
          {t('settings.categories.archived')}
        </Badge>
      )}
      {category.kind === 'EXPENSE' && category.necessity && (
        <Badge variant="dot" color={category.necessity === 'NEEDS' ? 'blue' : 'yellow'} size="sm">
          {t(`settings.categories.necessity.${category.necessity}`)}
        </Badge>
      )}
      <Menu position="bottom-end" width={240} shadow="md">
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t('settings.categories.actions', { name: category.name })}
          >
            <EllipsisVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<Pencil size={14} />} onClick={onEdit}>
            {t('accounts.menu.edit')}
          </Menu.Item>
          {group && (
            <Menu.Item leftSection={<Plus size={14} />} onClick={onAddChild}>
              {t('settings.categories.addChild')}
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={category.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            onClick={onArchive}
          >
            {t(category.archived ? 'accounts.menu.unarchive' : 'settings.categories.archive')}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<Trash2 size={14} />} disabled={hasChildren} onClick={onDelete}>
            {t('common.delete')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}
