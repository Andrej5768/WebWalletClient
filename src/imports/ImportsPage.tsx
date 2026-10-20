import {
  Button,
  Card,
  Group,
  Menu,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown, FileText, Landmark, TrendingUp, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccounts } from '../api/queries';
import { FileDropInput } from '../components/FileDropInput';
import { ProblemAlert } from '../components/feedback';
import {
  previewFreedom,
  previewPrivatBank,
  previewZenMoneyFile,
  previewZenMoneyToken,
  type BrokerPreview,
  type Preview,
} from './api';
import { BrokerPreviewModal } from './BrokerPreviewModal';
import { ImportPreviewModal } from './ImportPreviewModal';
import { MonobankSection } from './MonobankSection';

type ZenMode = 'token' | 'file';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ImportsPage() {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const [connectOpen, setConnectOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const [privatFile, setPrivatFile] = useState<File | null>(null);
  const [privatAccount, setPrivatAccount] = useState<string | null>(null);
  const [zenMode, setZenMode] = useState<ZenMode>('token');
  const [zenToken, setZenToken] = useState('');
  const [zenFile, setZenFile] = useState<File | null>(null);
  const [brokerPreview, setBrokerPreview] = useState<BrokerPreview | null>(null);
  const [freedomTrades, setFreedomTrades] = useState<File | null>(null);
  const [freedomCash, setFreedomCash] = useState<File | null>(null);
  const [freedomAccount, setFreedomAccount] = useState<string | null>(null);

  const privat = useMutation({
    mutationFn: () => previewPrivatBank(privatFile!, privatAccount ? Number(privatAccount) : undefined),
    onSuccess: setPreview,
    meta: { errorShown: true },
  });
  const zen = useMutation({
    mutationFn: () =>
      zenMode === 'token' ? previewZenMoneyToken(zenToken.trim()) : previewZenMoneyFile(zenFile!),
    onSuccess: (data) => {
      // The token is used once and should not stay in memory.
      setZenToken('');
      setPreview(data);
    },
    meta: { errorShown: true },
  });

  const freedom = useMutation({
    mutationFn: () =>
      previewFreedom(
        [freedomTrades, freedomCash].filter((file): file is File => file !== null),
        freedomAccount ? Number(freedomAccount) : undefined,
      ),
    onSuccess: setBrokerPreview,
    meta: { errorShown: true },
  });

  const brokerageAccounts = (accounts.data ?? [])
    .filter((account) => !account.archived && account.type === 'INVESTMENT')
    .map((account) => ({ value: String(account.id), label: `${account.name} · ${account.currency}` }));
  const cardAccounts = (accounts.data ?? [])
    .filter((account) => !account.archived && (account.type === 'CARD' || account.type === 'CREDIT_CARD'))
    .map((account) => ({ value: String(account.id), label: account.name }));

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Title order={1} size="h2">
          {t('nav.imports')}
        </Title>
        <Menu position="bottom-end" width={240} shadow="md">
          <Menu.Target>
            <Button leftSection={<Upload size={16} />} rightSection={<ChevronDown size={14} />}>
              {t('imports.import')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={() => {
                scrollTo('monobank');
                setConnectOpen(true);
              }}
            >
              {t('imports.sources.monobank')}
            </Menu.Item>
            <Menu.Item onClick={() => scrollTo('privatbank')}>{t('imports.sources.privatbank')}</Menu.Item>
            <Menu.Item
              onClick={() => {
                setZenMode('token');
                scrollTo('zenmoney');
              }}
            >
              {t('imports.sources.zenToken')}
            </Menu.Item>
            <Menu.Item
              onClick={() => {
                setZenMode('file');
                scrollTo('zenmoney');
              }}
            >
              {t('imports.sources.zenFile')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={() => scrollTo('freedom')}>{t('imports.sources.freedom')}</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <MonobankSection connectOpen={connectOpen} setConnectOpen={setConnectOpen} />

      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
        <Card withBorder radius="md" padding="lg" id="privatbank">
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon variant="light" color="gray" size={36} radius="md">
                <FileText size={18} />
              </ThemeIcon>
              <Stack gap={0}>
                <Title order={2} size="h4">
                  {t('imports.privat.title')}
                </Title>
                <Text size="xs" c="dimmed">
                  {t('imports.privat.subtitle')}
                </Text>
              </Stack>
            </Group>
            <FileDropInput
              label={t('imports.privat.file')}
              placeholder={t('imports.privat.choose')}
              accept="application/pdf,.pdf"
              clearable
              value={privatFile}
              onChange={setPrivatFile}
              description={t('imports.notStored')}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
            />
            <Select
              label={t('imports.privat.account')}
              description={t('imports.privat.accountHint')}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              placeholder={t('imports.privat.auto')}
              clearable
              data={cardAccounts}
              value={privatAccount}
              onChange={setPrivatAccount}
            />
            <ProblemAlert error={privat.error} />
            <Button disabled={!privatFile} loading={privat.isPending} onClick={() => privat.mutate()}>
              {t('imports.privat.submit')}
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg" id="zenmoney">
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon variant="light" color="gray" size={36} radius="md">
                <Landmark size={18} />
              </ThemeIcon>
              <Stack gap={0}>
                <Title order={2} size="h4">
                  {t('imports.zen.title')}
                </Title>
                <Text size="xs" c="dimmed">
                  {t('imports.zen.subtitle')}
                </Text>
              </Stack>
            </Group>
            <SegmentedControl
              aria-label={t('imports.zen.mode')}
              value={zenMode}
              onChange={(value) => setZenMode(value as ZenMode)}
              data={[
                { value: 'token', label: t('imports.zen.token') },
                { value: 'file', label: t('imports.zen.file') },
              ]}
            />
            {zenMode === 'token' ? (
              <PasswordInput
                label={t('imports.zen.tokenLabel')}
                autoComplete="off"
                description={t('imports.zen.tokenHint')}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                value={zenToken}
                onChange={(event) => setZenToken(event.currentTarget.value)}
              />
            ) : (
              <FileDropInput
                label={t('imports.zen.fileLabel')}
                placeholder={t('imports.privat.choose')}
                accept=".csv,text/csv,application/json,.json"
                clearable
                value={zenFile}
                onChange={setZenFile}
                description={t('imports.zen.fileHint')}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
              />
            )}
            <ProblemAlert error={zen.error} />
            <Button
              disabled={zenMode === 'token' ? !zenToken.trim() : !zenFile}
              loading={zen.isPending}
              onClick={() => zen.mutate()}
            >
              {t('imports.zen.submit')}
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg" id="freedom">
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon variant="light" color="gray" size={36} radius="md">
                <TrendingUp size={18} />
              </ThemeIcon>
              <Stack gap={0}>
                <Title order={2} size="h4">
                  {t('imports.freedom.title')}
                </Title>
                <Text size="xs" c="dimmed">
                  {t('imports.freedom.subtitle')}
                </Text>
              </Stack>
            </Group>
            <FileDropInput
              label={t('imports.freedom.trades')}
              placeholder={t('imports.privat.choose')}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              clearable
              value={freedomTrades}
              onChange={setFreedomTrades}
            />
            <FileDropInput
              label={t('imports.freedom.cashFlows')}
              placeholder={t('imports.privat.choose')}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              clearable
              value={freedomCash}
              onChange={setFreedomCash}
              description={t('imports.freedom.filesHint')}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
            />
            <Select
              label={t('imports.freedom.account')}
              placeholder={t('imports.freedom.auto')}
              description={t('imports.freedom.accountHint')}
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              clearable
              data={brokerageAccounts}
              value={freedomAccount}
              onChange={setFreedomAccount}
            />
            <ProblemAlert error={freedom.error} />
            <Button
              disabled={!freedomTrades && !freedomCash}
              loading={freedom.isPending}
              onClick={() => freedom.mutate()}
            >
              {t('imports.privat.submit')}
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>

      {preview && <ImportPreviewModal preview={preview} onClose={() => setPreview(null)} />}
      {brokerPreview && <BrokerPreviewModal preview={brokerPreview} onClose={() => setBrokerPreview(null)} />}
    </Stack>
  );
}
