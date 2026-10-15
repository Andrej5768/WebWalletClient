import { Alert, Anchor, Button, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { problemMessage, toProblem, type ApiProblem } from '../../api/errors';
import { AuthLayout } from '../AuthLayout';
import { requiredEmail } from '../validation';
import { CheckMail } from './CheckMail';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({ initialValues: { email: '' }, validate: { email: requiredEmail } });

  const submit = form.onSubmit(async ({ email }) => {
    setSubmitting(true);
    setProblem(null);
    const { error } = await api
      .POST('/api/v1/auth/forgot-password', { body: { email: email.trim() } })
      .catch((thrown: unknown) => ({ error: thrown }));
    setSubmitting(false);
    if (error) setProblem(toProblem(error));
    else setSent(true);
  });

  return (
    <AuthLayout>
      {sent ? (
        <CheckMail text={t('auth.forgot.sent')} />
      ) : (
        <form onSubmit={submit} noValidate>
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={1} size="h2">
                {t('auth.forgot.title')}
              </Title>
              <Text c="dimmed">{t('auth.forgot.subtitle')}</Text>
            </Stack>
            <TextInput
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              {...form.getInputProps('email')}
            />
            {problem && (
              <Alert color="yellow" variant="light" p="xs" role="alert">
                <Text size="sm">{problemMessage(problem)}</Text>
              </Alert>
            )}
            <Button type="submit" fullWidth size="md" loading={submitting}>
              {t('auth.forgot.submit')}
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
