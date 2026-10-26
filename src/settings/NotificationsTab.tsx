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
import { useAuth } from '../auth/context';
import type { components } from '../api/schema';
import { ProblemAlert } from '../components/feedback';
import { formatDay } from '../lib/format';
import { ConfirmIdentityModal } from './ConfirmIdentityModal';
import { identityMethod, type IdentityProof } from './identity';
import { selectableAccounts } from '../lib/accounts';

type Settings = components['schemas']['NotificationSettingsDto'];
type EmailKind = 'emailWeekly' | 'emailMonthly';
type Kind = Exclude<keyof Settings, 'hour' | EmailKind>;
type PendingLink = components['schemas']['TelegramLinkResponse'];

const telegramKey = ['telegram'] as const;
const settingsKey = ['notifications', 'settings'] as const;

/** The groups of notifications, in the order of the settings. */
const groups: { title: string; kinds: Kind[] }[] = [
  { title: 'reminders', kinds: ['recurring', 'budgets', 'taxes'] },
  { title: 'events', kinds: ['banks', 'forecast', 'goals'] },
  { title: 'reports', kinds: ['weekly', 'monthly'] },
];

/** The reports that also come by email, with their own switch. */
const emailKinds: Partial<Record<Kind, EmailKind>> = { weekly: 'emailWeekly', monthly: 'emailMonthly' };

/** Width of a column of switches, so the switches line up under their labels. */
const column = 64;

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

/**
 * Connects the chat by a one-time t.me link; the page checks until the user has pressed Start in the bot, or until
 * the link expires, then a new one can be made.
 */
function TelegramCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [confirming, setConfirming] = useState(false);
  const method = identityMethod(user);
  const status = useQuery({
    queryKey: telegramKey,
    queryFn: () => unwrap(api.GET('/api/v1/telegram')),
    refetchInterval: (query) => (pending && !query.state.data?.linked ? 3000 : false),
  });
  const accounts = useAccounts();
  const linked = status.data?.linked ?? false;
  const waiting = pending !== null && !linked;

  useEffect(() => {
    if (!pending || linked) return;
    const timer = setTimeout(
      () => {
        setPending(null);
        notifications.show({ message: t('settings.notifications.telegram.expired'), color: 'yellow' });
      },
      Math.max(0, Date.parse(pending.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [pending, linked, t]);

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
    mutationFn: (proof: IdentityProof) => unwrap(api.POST('/api/v1/telegram/link', { body: proof })),
    onSuccess: (data) => {
      setConfirming(false);
      setPending(data);
      window.open(data.url, '_blank', 'noopener');
    },
    gcTime: 0,
    meta: { errorShown: true },
  });
  const unlink = useMutation({
    mutationFn: () => check(api.DELETE('/api/v1/telegram')),
    onSuccess: () => {
      setPending(null);
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
  const openAccounts = selectableAccounts(accounts.data ?? []);

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
                      date: formatDay(data.linkedAt),
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
            <Button
              loading={link.isPending}
              onClick={() => (method ? setConfirming(true) : link.mutate({}))}
              style={{ flexShrink: 0 }}
            >
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
              <Button component="a" href={pending!.url} target="_blank" rel="noopener">
                {t('settings.notifications.telegram.open')}
              </Button>
              <Button variant="subtle" color="gray" onClick={() => setPending(null)}>
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
        <ProblemAlert error={(confirming ? null : link.error) ?? unlink.error ?? updateSettings.error} />
      </Stack>
      {confirming && method && (
        <ConfirmIdentityModal
          method={method}
          pending={link.isPending}
          error={link.error}
          onConfirm={(proof) => link.mutate(proof)}
          onClose={() => {
            setConfirming(false);
            link.reset();
          }}
        />
      )}
    </Card>
  );
}

/** A switch per kind of notification (and by email for the reports) and the hour they come at; saved on every change. */
function KindsCard({ linked }: { linked: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: () => unwrap(api.GET('/api/v1/notifications/settings')),
  });
  // Saves run one after another and each sends all the switches as shown, so only the last one to finish takes the
  // answer of the server: an earlier answer would turn back a switch changed since.
  const last = () => queryClient.isMutating({ mutationKey: settingsKey }) === 1;
  const save = useMutation({
    mutationKey: settingsKey,
    scope: { id: 'notification-settings' },
    mutationFn: (body: Settings) => unwrap(api.PUT('/api/v1/notifications/settings', { body })),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      queryClient.setQueryData(settingsKey, body);
    },
    onSuccess: (data) => {
      if (last()) queryClient.setQueryData(settingsKey, data);
    },
    onError: () => {
      if (last()) return queryClient.invalidateQueries({ queryKey: settingsKey });
    },
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
      {groups.map((group, index) => (
        <div key={group.title}>
          <Group
            justify="space-between"
            wrap="nowrap"
            px="lg"
            py={8}
            bg="var(--ww-subtle)"
            style={{ borderTop: '1px solid var(--ww-border)' }}
          >
            <Text size="xs" fw={600}>
              {t(`settings.notifications.groups.${group.title}`)}
            </Text>
            {index === 0 && (
              <Group gap="xs" wrap="nowrap" aria-hidden>
                {(['telegram', 'email'] as const).map((name) => (
                  <Text key={name} size="xs" c="dimmed" fw={600} ta="center" w={column}>
                    {t(`settings.notifications.columns.${name}`)}
                  </Text>
                ))}
              </Group>
            )}
          </Group>
          {group.kinds.map((kind) => {
            const emailKind = emailKinds[kind];
            const title = t(`settings.notifications.kinds.${kind}.title`);
            return (
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
                  <Text fw={500}>{title}</Text>
                  <Text size="sm" c="dimmed">
                    {t(`settings.notifications.kinds.${kind}.text`)}
                  </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap" mt={4} style={{ flexShrink: 0 }}>
                  <Group justify="center" w={column}>
                    <Switch
                      aria-label={title}
                      checked={linked && current[kind]}
                      disabled={!linked}
                      onChange={(event) => save.mutate({ ...current, [kind]: event.currentTarget.checked })}
                    />
                  </Group>
                  <Group justify="center" w={column}>
                    {emailKind ? (
                      <Switch
                        aria-label={t('settings.notifications.emailSwitch', { title })}
                        checked={current[emailKind] ?? false}
                        onChange={(event) =>
                          save.mutate({ ...current, [emailKind]: event.currentTarget.checked })
                        }
                      />
                    ) : (
                      <Text c="dimmed" aria-hidden>
                        —
                      </Text>
                    )}
                  </Group>
                </Group>
              </Group>
            );
          })}
        </div>
      ))}
      <Stack gap={4} px="lg" py="md" style={{ borderTop: '1px solid var(--ww-border)' }}>
        {!linked && (
          <Text size="sm" c="dimmed">
            {t('settings.notifications.notLinked')}
          </Text>
        )}
        <Text size="sm" c="dimmed">
          {t('settings.notifications.emailHint', { email: user?.email })}
        </Text>
      </Stack>
      <ProblemAlert error={save.error} />
    </Card>
  );
}
