import {
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, problemMessage, toProblem } from '../api/errors';
import { check } from '../api/http';
import { shareAccessToken } from '../api/session';
import { ProblemAlert } from '../components/feedback';
import { TwoFactorCard } from './TwoFactorCard';
import { newPassword, required } from '../lib/validation';
import i18n from '../i18n';

const CONFIRM_WORD = 'DELETE';

export function SecurityTab() {
  const { t } = useTranslation();
  const [resetOpen, setResetOpen] = useState(false);
  const form = useForm({
    initialValues: { current: '', password: '', repeat: '' },
    validate: {
      current: required,
      password: newPassword,
      repeat: (value, values) => (value === values.password ? null : i18n.t('validation.passwordsDiffer')),
    },
  });

  const change = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const { data, error } = await api.POST('/api/v1/me/password', {
        body: { currentPassword: values.current, newPassword: values.password },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // The other sessions are revoked; this one continues with the new token.
      if (data?.accessToken) shareAccessToken(data.accessToken);
      form.reset();
      // The passwords should not stay in the mutation cache.
      change.reset();
      notifications.show({ message: t('settings.security.changed'), color: 'green' });
    },
    onError: (error) => {
      const problem = toProblem(error);
      const errors = fieldErrors(problem);
      form.setErrors({
        current:
          errors.currentPassword ??
          (problem.code === 'INVALID_CURRENT_PASSWORD' ? problemMessage(problem) : undefined),
        password: errors.newPassword,
      });
    },
  });

  return (
    <Stack gap="lg" maw={640}>
      <Card withBorder radius="md" padding="lg">
        <form onSubmit={form.onSubmit((values) => change.mutate(values))} noValidate>
          <Stack gap="md">
            <Title order={2} size="h4">
              {t('settings.security.title')}
            </Title>
            <PasswordInput
              label={t('settings.security.current')}
              autoComplete="current-password"
              {...form.getInputProps('current')}
            />
            <PasswordInput
              label={t('auth.newPassword')}
              description={t('auth.passwordHint')}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              autoComplete="new-password"
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label={t('auth.repeatPassword')}
              autoComplete="new-password"
              {...form.getInputProps('repeat')}
            />
            <Text size="sm" c="dimmed">
              {t('settings.security.othersSignedOut')}
            </Text>
            {change.error && toProblem(change.error).code === 'TOO_MANY_ATTEMPTS' && (
              <Alert color="yellow" variant="light" p="xs" role="alert">
                {problemMessage(toProblem(change.error))}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button type="submit" loading={change.isPending}>
                {t('settings.security.submit')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      <TwoFactorCard />

      <Card withBorder radius="md" padding="lg" style={{ borderColor: 'var(--mantine-color-red-outline)' }}>
        <Stack gap="md">
          <Title order={2} size="h4">
            {t('settings.danger.title')}
          </Title>
          <Group justify="space-between" wrap="nowrap" gap="lg">
            <Stack gap={2}>
              <Text fw={500}>{t('settings.danger.resetTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('settings.danger.resetText')}
              </Text>
            </Stack>
            <Button color="red" variant="outline" onClick={() => setResetOpen(true)}>
              {t('settings.danger.resetButton')}
            </Button>
          </Group>
          <Group justify="space-between" wrap="nowrap" gap="lg">
            <Stack gap={2}>
              <Text fw={500}>{t('settings.danger.deleteTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('settings.danger.deleteText')}
              </Text>
            </Stack>
            <Button color="red" variant="outline" disabled>
              {t('settings.danger.deleteButton')}
            </Button>
          </Group>
        </Stack>
      </Card>
      {resetOpen && <ResetModal onClose={() => setResetOpen(false)} />}
    </Stack>
  );
}

function ResetModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [keepCategories, setKeepCategories] = useState(true);
  const [confirm, setConfirm] = useState('');

  const reset = useMutation({
    mutationFn: () => check(api.POST('/api/v1/me/reset', { body: { keepCategories, confirm } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      notifications.show({ message: t('settings.danger.done'), color: 'green' });
      onClose();
    },
    meta: { errorShown: true },
  });

  return (
    <Modal opened onClose={onClose} title={<Text fw={600}>{t('settings.danger.resetTitle')}</Text>}>
      <Stack gap="md">
        <Alert color="red" variant="light" icon={<TriangleAlert size={18} />}>
          {t('settings.danger.resetWarning')}
        </Alert>
        <Checkbox
          label={t('settings.danger.keepCategories')}
          checked={keepCategories}
          onChange={(event) => setKeepCategories(event.currentTarget.checked)}
        />
        <TextInput
          label={t('settings.danger.confirmLabel', { word: CONFIRM_WORD })}
          value={confirm}
          onChange={(event) => setConfirm(event.currentTarget.value)}
          autoComplete="off"
        />
        <ProblemAlert error={reset.error} />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            disabled={confirm !== CONFIRM_WORD}
            loading={reset.isPending}
            onClick={() => reset.mutate()}
          >
            {t('settings.danger.resetSubmit')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
