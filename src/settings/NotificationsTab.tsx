import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { check, unwrap } from '../api/http';
import { useAccounts } from '../api/queries';
import type { components } from '../api/schema';
import { ProblemAlert } from '../components/feedback';

type Settings = components['schemas']['NotificationSettingsDto'];
type Kind = Exclude<keyof Settings, 'hour'>;

const telegramKey = ['telegram'] as const;
const settingsKey = ['notifications', 'settings'] as const;

/** The groups of notifications, in the order of the settings. */
const groups: { title: string; kinds: Kind[] }[] = [
  { title: 'reminders', kinds: ['recurring', 'budgets', 'taxes'] },
  { title: 'events', kinds: ['banks', 'forecast', 'goals'] },
  { title: 'reports', kinds: ['weekly', 'monthly'] },
];

const hours = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}));

export function NotificationsTab() {
  const status = useQuery({ queryKey: telegramKey, queryFn: () => unwrap(api.GET('/api/v1/telegram')) });
  const linked = status.data?.linked ?? false;

  return (
    <Stack gap="lg" maw={720}>
      <TelegramCard />
      <KindsCard linked={linked} />
    </Stack>
  );
}

/** Connects the chat by a one-time t.me link; the page checks until the user has pressed Start in the bot. */
function TelegramCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const status = useQuery({
    queryKey: telegramKey,
    queryFn: () => unwrap(api.GET('/api/v1/telegram')),
    refetchInterval: (query) => (pendingUrl && !query.state.data?.linked ? 3000 : false),
  });
  const accounts = useAccounts();
  const linked = status.data?.linked ?? false;
  const waiting = pendingUrl !== null && !linked;

  // Tells when the chat got connected while the page was waiting for it
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (waiting) {
      wasWaiting.current = true;
    } else if (wasWaiting.current && linked) {
      wasWaiting.current = false;
      notifications.show({ message: t('settings.notifications.telegram.connected'), color: 'green' });
    }
  }, [waiting, linked, t]);

  const link = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/telegram/link')),
    onSuccess: (data) => {
      setPendingUrl(data.url);
      window.open(data.url, '_blank', 'noopener');
    },
    meta: { errorShown: true },
  });
  const unlink = useMutation({
    mutationFn: () => check(api.DELETE('/api/v1/telegram')),
    onSuccess: () => {
      setPendingUrl(null);
      return queryClient.invalidateQueries({ queryKey: telegramKey });
    },
    meta: { errorShown: true },
  });
  const updateSettings = useMutation({
    mutationFn: (quickEntryAccountId: number | null) =>
      unwrap(
        api.PUT('/api/v1/telegram/settings', {
          body: { quickEntryAccountId: quickEntryAccountId ?? undefined },
        }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(telegramKey, data);
      notifications.show({ message: t('settings.saved'), color: 'green' });
    },
    meta: { errorShown: true },
  });

  if (!status.data) return null;
  const data = status.data;
  const openAccounts = (accounts.data ?? []).filter((account) => !account.archived);

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap" gap="lg">
          <Group align="flex-start" wrap="nowrap" gap="md">
            <ThemeIcon size={32} radius="md" variant="light" color="cyan" aria-hidden>
              <Send size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Title order={2} size="h4">
                Telegram
              </Title>
              <Text size="sm" c="dimmed">
                {linked
                  ? t('settings.notifications.telegram.linkedAs', {
                      name: [data.firstName, data.username ? `@${data.username}` : null]
                        .filter(Boolean)
                        .join(' · '),
                      date: new Date(data.linkedAt!).toLocaleDateString(i18n.language),
                    })
                  : t('settings.notifications.telegram.text')}
              </Text>
            </Stack>
          </Group>
          {linked ? (
            <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
              <Badge color="green" variant="light">
                {t('settings.notifications.telegram.badge')}
              </Badge>
              <Button
                variant="default"
                color="red"
                loading={unlink.isPending}
                onClick={() => unlink.mutate()}
              >
                {t('settings.notifications.telegram.unlink')}
              </Button>
            </Group>
          ) : data.enabled && !waiting ? (
            <Button loading={link.isPending} onClick={() => link.mutate()} style={{ flexShrink: 0 }}>
              {t('settings.notifications.telegram.link')}
            </Button>
          ) : null}
        </Group>

        {!data.enabled && !linked && (
          <Text size="sm" c="dimmed">
            {t('settings.notifications.telegram.disabled')}
          </Text>
        )}

        {waiting && (
          <>
            <Alert color="blue" icon={<Clock size={18} />}>
              {t('settings.notifications.telegram.pending', { bot: `@${data.botUsername}` })}
            </Alert>
            <Group gap="xs">
              <Button component="a" href={pendingUrl!} target="_blank" rel="noopener">
                {t('settings.notifications.telegram.open')}
              </Button>
              <Button variant="subtle" color="gray" onClick={() => setPendingUrl(null)}>
                {t('common.cancel')}
              </Button>
            </Group>
          </>
        )}

        {linked && (
          <>
            <Divider />
            <Select
              label={t('settings.notifications.telegram.account')}
              description={t('settings.notifications.telegram.accountHint')}
              placeholder={t('settings.notifications.telegram.accountDefault')}
              data={openAccounts.map((account) => ({
                value: String(account.id),
                label: `${account.name} (${account.currency})`,
              }))}
              value={data.quickEntryAccountId != null ? String(data.quickEntryAccountId) : null}
              onChange={(value) => updateSettings.mutate(value ? Number(value) : null)}
              clearable
              maw={420}
            />
          </>
        )}
        <ProblemAlert error={link.error ?? unlink.error ?? updateSettings.error} />
      </Stack>
    </Card>
  );
}

/** A switch per kind of notification and the hour they come at; saved on every change. */
function KindsCard({ linked }: { linked: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: () => unwrap(api.GET('/api/v1/notifications/settings')),
  });
  const save = useMutation({
    mutationFn: (body: Settings) => unwrap(api.PUT('/api/v1/notifications/settings', { body })),
    onMutate: (body) => queryClient.setQueryData(settingsKey, body),
    onSuccess: (data) => queryClient.setQueryData(settingsKey, data),
    onError: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
    meta: { errorShown: true },
  });

  if (!settings.data) return null;
  const current = settings.data;

  return (
    <Card withBorder radius="md" padding={0}>
      <Group justify="space-between" px="lg" py="md">
        <Title order={2} size="h4">
          {t('settings.notifications.kinds.title')}
        </Title>
        <Select
          aria-label={t('settings.notifications.hour')}
          leftSection={<Clock size={14} />}
          data={hours}
          value={String(current.hour)}
          onChange={(value) => value && save.mutate({ ...current, hour: Number(value) })}
          allowDeselect={false}
          disabled={!linked}
          w={120}
        />
      </Group>
      {groups.map((group) => (
        <div key={group.title}>
          <Text
            size="xs"
            fw={600}
            px="lg"
            py={8}
            bg="var(--ww-subtle)"
            style={{ borderTop: '1px solid var(--ww-border)' }}
          >
            {t(`settings.notifications.groups.${group.title}`)}
          </Text>
          {group.kinds.map((kind) => (
            <Group
              key={kind}
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
              px="lg"
              py="sm"
              style={{ borderTop: '1px solid var(--ww-border)' }}
            >
              <Stack gap={2}>
                <Text fw={500}>{t(`settings.notifications.kinds.${kind}.title`)}</Text>
                <Text size="sm" c="dimmed">
                  {t(`settings.notifications.kinds.${kind}.text`)}
                </Text>
              </Stack>
              <Switch
                aria-label={t(`settings.notifications.kinds.${kind}.title`)}
                checked={linked && current[kind]}
                disabled={!linked}
                onChange={(event) => save.mutate({ ...current, [kind]: event.currentTarget.checked })}
                mt={4}
              />
            </Group>
          ))}
        </div>
      ))}
      {!linked && (
        <Text size="sm" c="dimmed" px="lg" py="md" style={{ borderTop: '1px solid var(--ww-border)' }}>
          {t('settings.notifications.notLinked')}
        </Text>
      )}
      <ProblemAlert error={save.error} />
    </Card>
  );
}
