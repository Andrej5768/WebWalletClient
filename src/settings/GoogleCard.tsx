import { Button, Card, Group, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../api/client';
import { check, unwrap } from '../api/http';
import { GoogleLogo } from '../auth/GoogleButton';
import { useGoogleSignIn } from '../auth/useGoogleSignIn';
import { useAuth } from '../auth/context';
import { ProblemAlert } from '../components/feedback';
import { useReloadUser } from './useReloadUser';

/** The linked Google account; linking goes through the Google page and comes back with the result in the fragment. */
export function GoogleCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const offered = useGoogleSignIn();
  const reloadUser = useReloadUser();

  const location = useLocation();
  const navigate = useNavigate();

  // The result of linking, from the redirect back from Google
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const result = params.get('google') ?? params.get('error');
    if (!result) return;
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    if (result === 'linked') {
      notifications.show({ message: t('settings.google.linked'), color: 'green' });
    } else if (result !== 'cancelled') {
      notifications.show({
        message: t(`settings.google.errors.${result}`, { defaultValue: t('settings.google.errors.failed') }),
        color: 'yellow',
      });
    }
  }, [location.hash, location.pathname, location.search, navigate, t]);

  const link = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/me/google/link')),
    onSuccess: (data) => window.location.assign(data.url),
    meta: { errorShown: true },
  });
  const unlink = useMutation({
    mutationFn: () => check(api.POST('/api/v1/me/google/unlink')),
    onSuccess: async () => {
      await reloadUser();
      notifications.show({ message: t('settings.google.unlinked'), color: 'green' });
    },
    meta: { errorShown: true },
  });

  const linkedEmail = user?.googleEmail;
  if (!offered && !linkedEmail) return null;

  const unlinkButton = (
    <Button
      variant="default"
      style={{ flexShrink: 0 }}
      disabled={!user?.hasPassword}
      loading={unlink.isPending}
      onClick={() => unlink.mutate()}
    >
      {t('settings.google.unlink')}
    </Button>
  );

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap" gap="lg">
          <Group align="flex-start" wrap="nowrap" gap="md">
            <ThemeIcon size={32} radius="md" variant="default" aria-hidden>
              <GoogleLogo size={16} />
            </ThemeIcon>
            <Stack gap={2}>
              <Title order={2} size="h4">
                {t('settings.google.title')}
              </Title>
              <Text size="sm" c="dimmed">
                {linkedEmail ? (
                  <>
                    {t('settings.google.linkedTo')}{' '}
                    <Text span ff="monospace" size="sm" c="var(--ww-text)">
                      {linkedEmail}
                    </Text>
                  </>
                ) : (
                  t('settings.google.text')
                )}
              </Text>
            </Stack>
          </Group>
          {!linkedEmail ? (
            <Button
              variant="default"
              loading={link.isPending}
              onClick={() => link.mutate()}
              style={{ flexShrink: 0 }}
            >
              {t('settings.google.link')}
            </Button>
          ) : user?.hasPassword ? (
            unlinkButton
          ) : (
            <Tooltip label={t('settings.google.setPasswordFirst')} withArrow multiline w={240}>
              <span>{unlinkButton}</span>
            </Tooltip>
          )}
        </Group>
        <ProblemAlert error={link.error ?? unlink.error} />
      </Stack>
    </Card>
  );
}

/** An account created with Google has no password; it is set through the reset email, which proves the address. */
export function SetPasswordCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const send = useMutation({
    mutationFn: () => check(api.POST('/api/v1/auth/forgot-password', { body: { email: user!.email } })),
    onSuccess: () => notifications.show({ message: t('settings.password.sent'), color: 'green' }),
    meta: { errorShown: true },
  });

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap" gap="lg">
          <Group align="flex-start" wrap="nowrap" gap="md">
            <ThemeIcon size={32} radius="md" variant="light" aria-hidden>
              <KeyRound size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Title order={2} size="h4">
                {t('settings.password.title')}
              </Title>
              <Text size="sm" c="dimmed">
                {t('settings.password.none')}
              </Text>
            </Stack>
          </Group>
          <Button
            variant="default"
            loading={send.isPending}
            onClick={() => send.mutate()}
            style={{ flexShrink: 0 }}
          >
            {t('settings.password.send')}
          </Button>
        </Group>
        <ProblemAlert error={send.error} />
      </Stack>
    </Card>
  );
}
