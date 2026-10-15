import { Button, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/** Footer of an edit form: an optional delete on the left, cancel and submit on the right. */
export function FormFooter({
  onCancel,
  onDelete,
  deleting,
  saving,
  submitLabel,
  submitDisabled,
  onSubmit,
}: {
  onCancel(): void;
  onDelete?: () => void;
  deleting?: boolean;
  saving?: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  /** Without it the submit button submits the surrounding form. */
  onSubmit?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Group justify="space-between" pt="xs">
      {onDelete ? (
        <Button variant="outline" color="red" loading={deleting} onClick={onDelete}>
          {t('common.delete')}
        </Button>
      ) : (
        <span />
      )}
      <Group gap="xs">
        <Button variant="default" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type={onSubmit ? 'button' : 'submit'}
          onClick={onSubmit}
          loading={saving}
          disabled={submitDisabled}
        >
          {submitLabel ?? t('common.save')}
        </Button>
      </Group>
    </Group>
  );
}
