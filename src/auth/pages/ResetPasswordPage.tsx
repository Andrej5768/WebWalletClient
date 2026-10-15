import { Alert, Anchor, Button, PasswordInput, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { api } from '../../api/client';
import { fieldErrors, problemMessage, toProblem, type ApiProblem } from '../../api/errors';
import i18n from '../../i18n';
import { AuthLayout } from '../AuthLayout';
import { tokenFromHash } from '../token';
import { newPassword } from '../validation';
import { ExpiredLink } from './ExpiredLink';

/** Opened from the password reset email: `/reset-password#token=…`. */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [token] = useState(() => tokenFromHash(location.hash));
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { password: '', repeat: '' },
    validate: {
      password: newPassword,
      repeat: (value, values) => (value === values.password ? null : i18n.t('validation.passwordsDiffer')),
    },
  });

  const submit = form.onSubmit(async ({ password }) => {
    if (!token) return;
    setSubmitting(true);
    setProblem(null);
    const { error } = await api
      .POST('/api/v1/auth/reset-password', { body: { token, newPassword: password } })
      .catch((thrown: unknown) => ({ error: thrown }));
    setSubmitting(false);
    if (!error) {
      setDone(true);
      return;
    }
    const result = toProblem(error);
    form.setErrors({ password: fieldErrors(result).newPassword });
    setProblem(result);
  });

  if (!token || problem?.code === 'INVALID_TOKEN') {
    return (
      <AuthLayout>
        <ExpiredLink
          text={t('auth.reset.expired')}
          action={{ to: '/forgot-password', label: t('auth.forgot.submit') }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {done ? (
        <Stack gap="md">
          <ThemeIcon size={36} radius="md" color="green" variant="light" aria-hidden>
            <Check size={18} />
          </ThemeIcon>
          <Title order={1} size="h2">
            {t('auth.reset.doneTitle')}
          </Title>
          <Text c="dimmed">{t('auth.reset.doneText')}</Text>
          <Button component={Link} to="/login" fullWidth size="md">
            {t('auth.login.submit')}
          </Button>
        </Stack>
      ) : (
        <form onSubmit={submit} noValidate>
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={1} size="h2">
                {t('auth.reset.title')}
              </Title>
              <Text c="dimmed">{t('auth.reset.subtitle')}</Text>
            </Stack>
            <PasswordInput
              label={t('auth.newPassword')}
              autoComplete="new-password"
              description={t('auth.passwordHint')}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label={t('auth.repeatPassword')}
              autoComplete="new-password"
              {...form.getInputProps('repeat')}
            />
            {problem && !problem.errors?.length && (
              <Alert color="yellow" variant="light" p="xs" role="alert">
                <Text size="sm">{problemMessage(problem)}</Text>
              </Alert>
            )}
            <Button type="submit" fullWidth size="md" loading={submitting}>
              {t('auth.reset.submit')}
            </Button>
            <Anchor component={Link} to="/login" ta="center" fw={500}>
              {t('auth.backToLogin')}
            </Anchor>
          </Stack>
        </form>
      )}
    </AuthLayout>
  );
}
