import { Anchor, Button, Center, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { BellOff, Check, Link2Off } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../api/client';
import { ProblemAlert } from '../../components/feedback';
import { AuthLayout } from '../AuthLayout';

type State = 'checking' | 'unsubscribed' | 'resubscribed' | 'invalid';

const settingsPath = '/settings?tab=notifications';

/** Opened from the «Відписатися» link of a digest email: `/unsubscribe?user=…&token=…`. */
export function UnsubscribePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [link] = useState(() => {
    const user = Number(params.get('user'));
    const token = params.get('token');
    return Number.isInteger(user) && user > 0 && token ? { user, token } : null;
  });
  const [state, setState] = useState<State>(link ? 'checking' : 'invalid');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const started = useRef(false);

  useEffect(() => {
    // Guard against the second effect run in StrictMode
    if (!link || started.current) return;
    started.current = true;
    void api
      .POST('/api/v1/notifications/unsubscribe', { params: { query: link } })
      .then(({ error }) => setState(error ? 'invalid' : 'unsubscribed'))
      .catch(() => setState('invalid'));
  }, [link]);

  const resubscribe = async () => {
    if (!link) return;
    setPending(true);
    setError(null);
    try {
      const { error } = await api.POST('/api/v1/notifications/resubscribe', { params: { query: link } });
      if (error) setError(error);
      else setState('resubscribed');
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  };

  const settingsLink = (
    <Anchor component={Link} to={settingsPath} size="sm" ta="center">
      {t('auth.unsubscribe.settings')}
    </Anchor>
  );

  return (
    <AuthLayout>
      {state === 'checking' && (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
      {state === 'unsubscribed' && (
        <Stack gap="md">
          <ThemeIcon size={36} radius="md" color="gray" variant="light" aria-hidden>
            <BellOff size={18} />
          </ThemeIcon>
          <Title order={1} size="h2">
            {t('auth.unsubscribe.doneTitle')}
          </Title>
          <Text c="dimmed">{t('auth.unsubscribe.doneText')}</Text>
          <ProblemAlert error={error} />
          <Button fullWidth size="md" loading={pending} onClick={() => void resubscribe()}>
            {t('auth.unsubscribe.resubscribe')}
          </Button>
          {settingsLink}
        </Stack>
      )}
      {state === 'resubscribed' && (
        <Stack gap="md">
          <ThemeIcon size={36} radius="md" color="green" variant="light" aria-hidden>
            <Check size={18} />
          </ThemeIcon>
          <Title order={1} size="h2">
            {t('auth.unsubscribe.backTitle')}
          </Title>
          <Text c="dimmed">{t('auth.unsubscribe.backText')}</Text>
          {settingsLink}
        </Stack>
      )}
      {state === 'invalid' && (
        <Stack gap="md">
          <ThemeIcon size={36} radius="md" color="yellow" variant="light" aria-hidden>
            <Link2Off size={18} />
          </ThemeIcon>
          <Title order={1} size="h2">
            {t('auth.unsubscribe.invalid')}
          </Title>
          {settingsLink}
        </Stack>
      )}
    </AuthLayout>
  );
}
