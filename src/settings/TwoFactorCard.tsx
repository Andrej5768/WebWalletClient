import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  CopyButton,
  Group,
  Image,
  Modal,
  PasswordInput,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { check, unwrap } from '../api/http';
import { useAuth } from '../auth/context';
import { ProblemAlert } from '../components/feedback';
import { saveBlob } from '../lib/download';
import { useReloadUser } from './useReloadUser';

const codeInputStyles = {
  input: { fontFamily: 'var(--mantine-font-family-monospace)', letterSpacing: '0.25em' },
};

/** Two-factor authentication: turning it on and off and the recovery codes. */
export function TwoFactorCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dialog, setDialog] = useState<'setup' | 'disable' | 'codes' | null>(null);
  const enabled = user?.twoFactorEnabled ?? false;

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="lg">
          <Group align="flex-start" wrap="nowrap" gap="md">
            <ThemeIcon size={32} radius="md" variant="light" aria-hidden>
              <ShieldCheck size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Group gap="xs">
                <Title order={2} size="h4">
                  {t('settings.twoFactor.title')}
                </Title>
                {enabled && (
                  <Badge color="green" variant="light">
                    {t('settings.twoFactor.on')}
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {t('settings.twoFactor.text')}
              </Text>
            </Stack>
          </Group>
          {!enabled && <Button onClick={() => setDialog('setup')}>{t('settings.twoFactor.enable')}</Button>}
        </Group>
        {enabled && (
          <Group justify="space-between" gap="md" pt="md" style={{ borderTop: '1px solid var(--ww-border)' }}>
            <Text size="sm" c="dimmed">
              {t('settings.twoFactor.codesLeft', { count: user?.recoveryCodesLeft ?? 0 })}
            </Text>
            <Group gap="xs">
              <Button variant="default" size="xs" onClick={() => setDialog('codes')}>
                {t('settings.twoFactor.newCodes')}
              </Button>
              <Button variant="default" size="xs" c="red" onClick={() => setDialog('disable')}>
                {t('settings.twoFactor.disable')}
              </Button>
            </Group>
          </Group>
        )}
      </Stack>
      {dialog === 'setup' && <SetupModal onClose={() => setDialog(null)} />}
      {dialog === 'disable' && <DisableModal onClose={() => setDialog(null)} />}
      {dialog === 'codes' && <NewCodesModal onClose={() => setDialog(null)} />}
    </Card>
  );
}

function SetupModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const reloadUser = useReloadUser();
  const [code, setCode] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const setup = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/me/two-factor/setup')),
    meta: { errorShown: true },
  });
  const enable = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/me/two-factor/enable', { body: { code: code.trim() } })),
    onSuccess: async (data) => {
      setCodes(data.recoveryCodes);
      await reloadUser();
    },
    meta: { errorShown: true },
  });

  const { mutate: startSetup } = setup;
  useEffect(() => startSetup(), [startSetup]);
  useEffect(() => {
    if (!setup.data) return;
    // SVG needs no canvas and fits the content security policy as a data: image
    void QRCode.toString(setup.data.otpauthUri, { type: 'svg', margin: 1 }).then((svg) =>
      setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`),
    );
  }, [setup.data]);

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      closeOnClickOutside={!codes}
      title={<Text fw={600}>{t('settings.twoFactor.setupTitle')}</Text>}
    >
      {codes ? (
        <RecoveryCodes codes={codes} onDone={onClose} />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            enable.mutate();
          }}
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t('settings.twoFactor.scan')}
            </Text>
            <ProblemAlert error={setup.error} />
            <Group align="flex-start" gap="lg" wrap="nowrap">
              {qr ? (
                <Image src={qr} w={168} h={168} alt={t('settings.twoFactor.qrAlt')} radius="sm" />
              ) : (
                <Skeleton w={168} h={168} />
              )}
              <Stack gap="xs" style={{ minWidth: 0 }}>
                <Text fw={500} size="sm">
                  {t('settings.twoFactor.manual')}
                </Text>
                {setup.data ? (
                  <>
                    <Code block style={{ wordBreak: 'break-all' }}>
                      {setup.data.secret.replace(/(.{4})/g, '$1 ').trim()}
                    </Code>
                    <CopyButton value={setup.data.secret}>
                      {({ copied, copy }) => (
                        <Button
                          variant="default"
                          size="xs"
                          onClick={copy}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          {copied ? t('settings.twoFactor.copied') : t('settings.twoFactor.copyKey')}
                        </Button>
                      )}
                    </CopyButton>
                  </>
                ) : (
                  <Skeleton h={48} />
                )}
              </Stack>
            </Group>
            <TextInput
              label={t('settings.twoFactor.appCode')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              w={200}
              styles={codeInputStyles}
              value={code}
              onChange={(event) => setCode(event.currentTarget.value)}
            />
            <ProblemAlert error={enable.error} />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!setup.data || !code.trim()} loading={enable.isPending}>
                {t('settings.twoFactor.confirm')}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone(): void }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');

  const download = () =>
    saveBlob(new Blob([text + '\n'], { type: 'text/plain' }), 'webwallet-recovery-codes.txt');

  return (
    <Stack gap="md">
      <Alert color="yellow" variant="light" icon={<TriangleAlert size={18} />}>
        {t('settings.twoFactor.codesWarning')}
      </Alert>
      <SimpleGrid
        cols={2}
        spacing="xs"
        verticalSpacing={6}
        p="md"
        bg="var(--ww-subtle)"
        style={{ borderRadius: 8 }}
      >
        {codes.map((code) => (
          <Text key={code} ff="monospace" size="md">
            {code}
          </Text>
        ))}
      </SimpleGrid>
      <Group gap="xs">
        <Button variant="default" size="xs" onClick={download}>
          {t('settings.twoFactor.download')}
        </Button>
        <CopyButton value={text}>
          {({ copied, copy }) => (
            <Button variant="default" size="xs" onClick={copy}>
              {copied ? t('settings.twoFactor.copied') : t('settings.twoFactor.copy')}
            </Button>
          )}
        </CopyButton>
      </Group>
      <Checkbox
        label={t('settings.twoFactor.saved')}
        checked={saved}
        onChange={(event) => setSaved(event.currentTarget.checked)}
      />
      <Group justify="flex-end">
        <Button disabled={!saved} onClick={onDone}>
          {t('settings.twoFactor.done')}
        </Button>
      </Group>
    </Stack>
  );
}

function DisableModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const reloadUser = useReloadUser();
  const { user } = useAuth();
  const needsPassword = user?.hasPassword !== false;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const disable = useMutation({
    mutationFn: () =>
      check(api.POST('/api/v1/me/two-factor/disable', { body: { password, code: code.trim() } })),
    onSuccess: async () => {
      await reloadUser();
      notifications.show({ message: t('settings.twoFactor.disabled'), color: 'green' });
      onClose();
    },
    meta: { errorShown: true },
  });

  return (
    <Modal opened onClose={onClose} title={<Text fw={600}>{t('settings.twoFactor.disableTitle')}</Text>}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          disable.mutate();
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('settings.twoFactor.disableText')}
          </Text>
          {needsPassword && (
            <PasswordInput
              label={t('auth.password')}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          )}
          <TextInput
            label={t('settings.twoFactor.codeOrRecovery')}
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.currentTarget.value)}
          />
          <ProblemAlert error={disable.error} />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              color="red"
              disabled={(needsPassword && !password) || !code.trim()}
              loading={disable.isPending}
            >
              {t('settings.twoFactor.disable')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function NewCodesModal({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const reloadUser = useReloadUser();
  const [code, setCode] = useState('');

  const regenerate = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/api/v1/me/two-factor/recovery-codes', { body: { code: code.trim() } })),
    onSuccess: () => reloadUser(),
    meta: { errorShown: true },
  });

  return (
    <Modal
      opened
      onClose={onClose}
      closeOnClickOutside={!regenerate.data}
      title={<Text fw={600}>{t('settings.twoFactor.newCodesTitle')}</Text>}
    >
      {regenerate.data ? (
        <RecoveryCodes codes={regenerate.data.recoveryCodes} onDone={onClose} />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            regenerate.mutate();
          }}
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t('settings.twoFactor.newCodesText')}
            </Text>
            <TextInput
              label={t('settings.twoFactor.appCode')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              w={200}
              styles={codeInputStyles}
              value={code}
              onChange={(event) => setCode(event.currentTarget.value)}
            />
            <ProblemAlert error={regenerate.error} />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!code.trim()} loading={regenerate.isPending}>
                {t('settings.twoFactor.newCodesSubmit')}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
