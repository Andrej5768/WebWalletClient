import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { fieldErrors, problemMessage, toProblem, type ApiProblem } from '../../api/errors';
import { AuthLayout } from '../AuthLayout';
import { GoogleSignIn } from '../GoogleButton';
import { newPassword, required, requiredEmail } from '../../lib/validation';
import { CheckMail } from './CheckMail';

export function RegisterPage() {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { firstName: '', lastName: '', email: '', password: '' },
    validate: { firstName: required, email: requiredEmail, password: newPassword },
  });

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setProblem(null);
    const email = values.email.trim();
    const { error } = await api
      .POST('/api/v1/auth/register', {
        body: {
          email,
          password: values.password,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
        },
      })
      .catch((thrown: unknown) => ({ error: thrown }));
    setSubmitting(false);
    if (error) {
      const result = toProblem(error);
      form.setErrors(fieldErrors(result));
      setProblem(result);
      return;
    }
    // The backend always answers 202 so the page does not reveal whether the email is taken.
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <AuthLayout>
        <CheckMail text={t('auth.checkMail.registered')} resendTo={sentTo} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} noValidate>
        <Stack gap="lg">
          <Stack gap={4}>
            <Title order={1} size="h2">
              {t('auth.register.title')}
            </Title>
            <Text c="dimmed">{t('auth.register.subtitle')}</Text>
          </Stack>
          <GoogleSignIn />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput
              label={t('auth.firstName')}
              withAsterisk
              autoComplete="given-name"
              {...form.getInputProps('firstName')}
            />
            <TextInput
              label={
                <>
                  {t('auth.lastName')}{' '}
                  <Text span c="dimmed" fw={400} size="sm">
                    {t('auth.optional')}
                  </Text>
                </>
              }
              autoComplete="family-name"
              {...form.getInputProps('lastName')}
            />
          </SimpleGrid>
          <TextInput
            label={t('auth.email')}
            withAsterisk
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label={t('auth.password')}
            withAsterisk
            autoComplete="new-password"
            description={t('auth.passwordHint')}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            {...form.getInputProps('password')}
          />
          <Text size="xs" c="dimmed">
            <Text span c="red">
              *
            </Text>{' '}
            {t('auth.requiredNote')}
          </Text>
          {problem && !problem.errors?.length && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              <Text size="sm">{problemMessage(problem)}</Text>
            </Alert>
          )}
          <Button type="submit" fullWidth size="md" loading={submitting}>
            {t('auth.register.submit')}
          </Button>
          <Text c="dimmed" ta="center">
            {t('auth.register.haveAccount')}{' '}
            <Anchor component={Link} to="/login" fw={500}>
              {t('auth.login.submit')}
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
