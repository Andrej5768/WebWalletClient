import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import i18n from '../i18n';

/** Asks before deleting something; `onConfirm` runs only after the user agrees. */
export function confirmDelete({
  title,
  text,
  onConfirm,
}: {
  title: string;
  text?: string;
  onConfirm(): void;
}) {
  modals.openConfirmModal({
    title: <Text fw={600}>{title}</Text>,
    children: <Text size="sm">{text ?? i18n.t('common.deleteWarning')}</Text>,
    labels: { confirm: i18n.t('common.delete'), cancel: i18n.t('common.cancel') },
    confirmProps: { color: 'red' },
    onConfirm,
  });
}
