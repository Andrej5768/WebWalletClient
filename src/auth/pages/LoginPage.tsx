import { Alert, Anchor, Button, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { problemMessage, type ApiProblem } from '../../api/errors';
import { AuthLayout } from '../AuthLayout';
import { DemoButton } from '../DemoButton';
import { GoogleSignIn } from '../GoogleButton';
import { useAuth } from '../context';
import { required, requiredEmail } from '../../lib/validation';
import { PendingDeletion } from '../PendingDeletion';
import { TwoFactorStep } from './TwoFactorStep';

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: { email: requiredEmail, password: required },
  });

  const signedIn = () => {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    void navigate(from, { replace: true });
  };

  const submit = form.onSubmit(async ({ email, password }) => {
    setSubmitting(true);
    setProblem(null);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.status === 'problem') setProblem(result.problem);
    else if (result.status === 'twoFactor') setChallenge(result.challenge);
    else signedIn();
  });

  const invalid = problem?.code === 'INVALID_CREDENTIALS';

  if (problem?.code === 'ACCOUNT_DELETION_SCHEDULED') {
    return (
      <AuthLayout>
        <PendingDeletion problem={problem} onRestored={signedIn} onBack={() => setProblem(null)} />
      </AuthLayout>
    );
  }

  if (challenge) {
    return (
      <AuthLayout>
        <TwoFactorStep
          challenge={challenge}
          onSignedIn={signedIn}
          onExpired={(expired) => {
            setChallenge(null);
            setProblem(expired);
          }}
          onBack={() => setChallenge(null)}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} noValidate>
        <Stack gap="lg">
          <Stack gap={4}>
            <Title order={1} size="h2">
              {t('auth.login.title')}
            </Title>
            <Text c="dimmed">{t('auth.login.subtitle')}</Text>
          </Stack>
          <GoogleSignIn />
          <TextInput
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            error={invalid || undefined}
            {...form.getInputProps('email')}
          />
          <Stack gap={6}>
            <Group justify="space-between" align="baseline">
              <Text component="label" htmlFor="login-password" size="sm" fw={500}>
                {t('auth.password')}
              </Text>
              <Anchor component={Link} to="/forgot-password" size="sm" fw={500}>
                {t('auth.login.forgot')}
              </Anchor>
            </Group>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              aria-describedby={problem ? 'login-problem' : undefined}
              error={invalid || undefined}
              {...form.getInputProps('password')}
            />
          </Stack>
          <Stack gap="xs">
            {problem && (
              <Alert
                id="login-problem"
                role="alert"
                color="yellow"
                variant="light"
                p="xs"
                icon={<CircleAlert size={16} />}
              >
                <Text size="sm">{problemMessage(problem)}</Text>
                {problem.code === 'EMAIL_NOT_VERIFIED' && (
                  <Anchor component={Link} to="/verify-email" size="sm">
                    {t('auth.verify.resend')}
                  </Anchor>
                )}
              </Alert>
            )}
            <Button type="submit" fullWidth size="md" loading={submitting}>
              {t('auth.login.submit')}
            </Button>
          </Stack>
          <DemoButton hint />
          <Text c="dimmed" ta="center">
            {t('auth.login.noAccount')}{' '}
            <Anchor component={Link} to="/register" fw={500}>
              {t('auth.login.register')}
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
