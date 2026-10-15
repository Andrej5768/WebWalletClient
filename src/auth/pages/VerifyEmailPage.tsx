import { Button, Center, Loader, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { api } from '../../api/client';
import { AuthLayout } from '../AuthLayout';
import { tokenFromHash, useStripTokenFromUrl } from '../token';
import { requiredEmail } from '../../lib/validation';
import { CheckMail } from './CheckMail';
import { ExpiredLink } from './ExpiredLink';

type State = 'checking' | 'confirmed' | 'expired' | 'resent';

/** Opened from the confirmation email: `/verify-email#token=…`. Without a token it offers a new link. */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [token] = useState(() => tokenFromHash(location.hash));
  useStripTokenFromUrl();
  const [state, setState] = useState<State>(token ? 'checking' : 'expired');
  const [resentTo, setResentTo] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // The token is single-use: guard against the second effect run in StrictMode.
    if (!token || started.current) return;
    started.current = true;
    void api
      .POST('/api/v1/auth/verify-email', { body: { token } })
      .then(({ error }) => setState(error ? 'expired' : 'confirmed'))
      .catch(() => setState('expired'));
  }, [token]);

  const form = useForm({ initialValues: { email: '' }, validate: { email: requiredEmail } });
  const resend = form.onSubmit(async ({ email }) => {
    await api
      .POST('/api/v1/auth/resend-verification', { body: { email: email.trim() } })
      .catch(() => undefined);
    setResentTo(email.trim());
    setState('resent');
  });

  return (
    <AuthLayout>
      {state === 'checking' && (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
      {state === 'confirmed' && (
        <Stack gap="md">
          <ThemeIcon size={36} radius="md" color="green" variant="light" aria-hidden>
            <Check size={18} />
          </ThemeIcon>
          <Title order={1} size="h2">
            {t('auth.verify.doneTitle')}
          </Title>
          <Text c="dimmed">{t('auth.verify.doneText')}</Text>
          <Button component={Link} to="/login" fullWidth size="md">
            {t('auth.login.submit')}
          </Button>
        </Stack>
      )}
      {state === 'expired' && (
        <form onSubmit={resend} noValidate>
          <ExpiredLink text={t('auth.verify.expired')}>
            <TextInput
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              {...form.getInputProps('email')}
            />
            <Button type="submit" fullWidth size="md">
              {t('auth.verify.resend')}
            </Button>
          </ExpiredLink>
        </form>
      )}
      {state === 'resent' && <CheckMail text={t('auth.checkMail.registered')} resendTo={resentTo} />}
    </AuthLayout>
  );
}
