import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { problemMessage, toProblem } from '../../api/errors';
import { AuthLayout } from '../AuthLayout';

/** The link of the deletion email: cancels the deletion; signing in still needs the password and the code. */
export function RestoreAccountPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token'));
  const [state, setState] = useState<'working' | 'restored' | { failed: string }>(() =>
    token ? 'working' : { failed: t('auth.deletion.badLink') },
  );
  const started = useRef(false);

  useEffect(() => {
    if (location.hash) void navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void api
      .POST('/api/v1/auth/restore', { body: { token } })
      .then(({ error }) => setState(error ? { failed: problemMessage(toProblem(error)) } : 'restored'))
      .catch((thrown: unknown) => setState({ failed: problemMessage(toProblem(thrown)) }));
  }, [token]);

  if (state === 'working') {
    return (
      <Center mih="100vh">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <AuthLayout>
      <Stack gap="lg">
        <Title order={1} size="h2">
          {state === 'restored' ? t('auth.deletion.restoredTitle') : t('auth.deletion.failedTitle')}
        </Title>
        {state === 'restored' ? (
          <Text c="dimmed">{t('auth.deletion.restoredText')}</Text>
        ) : (
          <Alert role="alert" color="yellow" variant="light" p="xs">
            <Text size="sm">{state.failed}</Text>
          </Alert>
        )}
        <Button component={Link} to="/login" size="md">
          {t('auth.backToLogin')}
        </Button>
      </Stack>
    </AuthLayout>
  );
}
