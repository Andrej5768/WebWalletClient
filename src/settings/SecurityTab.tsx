import { Button, Card, Group, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, problemMessage, toProblem } from '../api/errors';
import { shareAccessToken } from '../api/session';
import { useAuth } from '../auth/context';
import { ProblemAlert } from '../components/feedback';
import { GoogleCard, SetPasswordCard } from './GoogleCard';
import { TwoFactorCard } from './TwoFactorCard';
import { newPassword, required } from '../lib/validation';
import i18n from '../i18n';

export function SecurityTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
      {user?.hasPassword === false ? (
        <SetPasswordCard />
      ) : (
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
              {/* A wrong current password is shown at its field, the other problems here */}
              {change.error && toProblem(change.error).code !== 'INVALID_CURRENT_PASSWORD' && (
                <ProblemAlert error={change.error} fieldsShown={['currentPassword', 'newPassword']} />
              )}
              <Group justify="flex-end">
                <Button type="submit" loading={change.isPending}>
                  {t('settings.security.submit')}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      )}

      <TwoFactorCard />

      <GoogleCard />
    </Stack>
  );
}
