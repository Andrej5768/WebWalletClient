import {
  Alert,
  Button,
  Card,
  Checkbox,
  Code,
  Group,
  List,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Download, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { check, unwrap } from '../api/http';
import { useAuth } from '../auth/context';
import { ProblemAlert } from '../components/feedback';
import { saveDownload } from '../lib/download';
import { formatDate } from '../lib/format';

const CONFIRM_WORD = 'DELETE';

const exportData = () =>
  saveDownload(api.GET('/api/v1/me/export', { parseAs: 'blob' }), 'webwallet-export.zip');

/** The data of the user: export, starting over and deleting the account. */
export function DataTab() {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<'reset' | 'delete' | null>(null);
  const download = useMutation({ mutationFn: exportData, meta: { errorShown: true } });

  return (
    <Stack gap="lg" maw={640}>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="lg">
            <Group align="flex-start" wrap="nowrap" gap="md">
              <ThemeIcon size={32} radius="md" variant="light" aria-hidden>
                <Download size={18} />
              </ThemeIcon>
              <Stack gap={2}>
                <Title order={2} size="h4">
                  {t('settings.data.exportTitle')}
                </Title>
                <Text size="sm" c="dimmed">
                  {t('settings.data.exportText')}
                </Text>
              </Stack>
            </Group>
            <Button loading={download.isPending} onClick={() => download.mutate()} style={{ flexShrink: 0 }}>
              {t('settings.data.exportButton')}
            </Button>
          </Group>
          <List size="sm" c="dimmed" ml={46} spacing={4}>
            <List.Item>
              <Code>webwallet.json</Code> — {t('settings.data.exportJson')}
            </List.Item>
            <List.Item>
              <Code>transactions.csv</Code> — {t('settings.data.exportCsv')}
            </List.Item>
            <List.Item>{t('settings.data.exportSecrets')}</List.Item>
          </List>
          <ProblemAlert error={download.error} />
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="lg" style={{ borderColor: 'var(--mantine-color-red-outline)' }}>
        <Stack gap="md">
          <Title order={2} size="h4">
            {t('settings.danger.title')}
          </Title>
          <Group justify="space-between" wrap="nowrap" gap="lg">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={500}>{t('settings.danger.resetTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('settings.danger.resetText')}
              </Text>
            </Stack>
            <Button
              color="red"
              variant="outline"
              onClick={() => setDialog('reset')}
              style={{ flexShrink: 0 }}
            >
              {t('settings.danger.resetButton')}
            </Button>
          </Group>
          <Group justify="space-between" wrap="nowrap" gap="lg">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={500}>{t('settings.danger.deleteTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('settings.danger.deleteText')}
              </Text>
            </Stack>
            <Button color="red" onClick={() => setDialog('delete')} style={{ flexShrink: 0 }}>
              {t('settings.danger.deleteButton')}
            </Button>
          </Group>
        </Stack>
      </Card>
      {dialog === 'reset' && <ResetModal onClose={() => setDialog(null)} />}
      {dialog === 'delete' && <DeleteAccountModal onClose={() => setDialog(null)} />}
    </Stack>
  );
}

function ResetModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [keepCategories, setKeepCategories] = useState(true);
  const [confirm, setConfirm] = useState('');

  const reset = useMutation({
    mutationFn: () => check(api.POST('/api/v1/me/reset', { body: { keepCategories, confirm } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      notifications.show({ message: t('settings.danger.done'), color: 'green' });
      onClose();
    },
    meta: { errorShown: true },
  });

  return (
    <Modal opened onClose={onClose} title={<Text fw={600}>{t('settings.danger.resetTitle')}</Text>}>
      <Stack gap="md">
        <Alert color="red" variant="light" icon={<TriangleAlert size={18} />}>
          {t('settings.danger.resetWarning')}
        </Alert>
        <Checkbox
          label={t('settings.danger.keepCategories')}
          checked={keepCategories}
          onChange={(event) => setKeepCategories(event.currentTarget.checked)}
        />
        <TextInput
          label={t('settings.danger.confirmLabel', { word: CONFIRM_WORD })}
          value={confirm}
          onChange={(event) => setConfirm(event.currentTarget.value)}
          autoComplete="off"
        />
        <ProblemAlert error={reset.error} />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            disabled={confirm !== CONFIRM_WORD}
            loading={reset.isPending}
            onClick={() => reset.mutate()}
          >
            {t('settings.danger.resetSubmit')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function DeleteAccountModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const { user, endSession } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [code, setCode] = useState('');
  const hasPassword = user?.hasPassword !== false;
  const twoFactor = user?.twoFactorEnabled ?? false;
  const deletionDate = formatDate(dayjs().add(14, 'day').format('YYYY-MM-DD'));

  const download = useMutation({ mutationFn: exportData, meta: { errorShown: true } });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/api/v1/me/delete', {
          body: {
            password: hasPassword ? password : null,
            confirmEmail: hasPassword ? null : confirmEmail,
            code: twoFactor ? code.trim() : null,
          },
        }),
      ),
    meta: { errorShown: true },
  });

  // The server ended all sessions; this tab signs out and shows the home page
  const leave = endSession;

  const ready = (hasPassword ? password : confirmEmail.trim()) && (!twoFactor || code.trim());

  return (
    <Modal
      opened
      onClose={remove.data ? leave : onClose}
      title={
        <Text fw={600}>{remove.data ? t('settings.delete.doneTitle') : t('settings.delete.title')}</Text>
      }
    >
      {remove.data ? (
        <Stack gap="md">
          <Text size="sm">
            {t('settings.delete.doneText', {
              date: formatDate(dayjs(remove.data.deletionScheduledAt).format('YYYY-MM-DD')),
              email: user?.email,
            })}
          </Text>
          <Group justify="flex-end">
            <Button onClick={leave}>{t('settings.delete.ok')}</Button>
          </Group>
        </Stack>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            remove.mutate();
          }}
        >
          <Stack gap="md">
            <List size="sm" c="dimmed" spacing={6}>
              <List.Item>{t('settings.delete.blocked')}</List.Item>
              <List.Item>{t('settings.delete.erased', { date: deletionDate })}</List.Item>
              <List.Item>{t('settings.delete.cancel')}</List.Item>
            </List>
            <Group
              justify="space-between"
              wrap="nowrap"
              gap="md"
              p="sm"
              bg="var(--ww-subtle)"
              style={{ borderRadius: 6 }}
            >
              <Text size="sm">{t('settings.delete.exportFirst')}</Text>
              <Button
                variant="default"
                size="xs"
                loading={download.isPending}
                onClick={() => download.mutate()}
              >
                {t('settings.data.exportButton')}
              </Button>
            </Group>
            {hasPassword ? (
              <PasswordInput
                label={t('auth.password')}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            ) : (
              <TextInput
                label={t('settings.delete.confirmEmail')}
                description={user?.email}
                autoComplete="off"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.currentTarget.value)}
              />
            )}
            {twoFactor && (
              <TextInput
                label={t('settings.twoFactor.codeOrRecovery')}
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
              />
            )}
            <ProblemAlert error={remove.error ?? download.error} />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" color="red" disabled={!ready} loading={remove.isPending}>
                {t('settings.danger.deleteButton')}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
