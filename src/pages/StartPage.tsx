import {
  Card,
  Center,
  Group,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';

/** Temporary landing page that shows the theme, fonts and languages until sign-in is built. */
export function StartPage() {
  const { t, i18n } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Center mih="100vh" p="md">
      <Card withBorder radius="lg" padding="xl" maw={460} w="100%">
        <Stack gap="lg">
          <Group gap="sm">
            <ThemeIcon size={32} radius="md">
              <Wallet size={18} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              {t('app.name')}
            </Text>
          </Group>
          <Stack gap={4}>
            <Title order={1} size="h2">
              {t('start.title')}
            </Title>
            <Text c="dimmed">{t('start.text')}</Text>
          </Stack>
          <Stack gap={6}>
            <Group justify="space-between">
              <Text>{t('start.income')}</Text>
              <Text className="num income" fw={500}>
                {formatMoney(52000, 'UAH', { signed: true })}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text>{t('start.expense')}</Text>
              <Text className="num expense" fw={500}>
                {formatMoney(-1284.5, 'UAH', { signed: true })}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text>{t('start.transfer')}</Text>
              <Text className="num muted" fw={500}>
                {formatMoney(5000, 'UAH')}
              </Text>
            </Group>
          </Stack>
          <Group justify="space-between" wrap="wrap">
            <SegmentedControl
              aria-label={t('language.label')}
              size="xs"
              value={i18n.language}
              onChange={(value) => void i18n.changeLanguage(value)}
              data={[
                { value: 'uk', label: 'УКР' },
                { value: 'en', label: 'ENG' },
              ]}
            />
            <SegmentedControl
              aria-label={t('theme.label')}
              size="xs"
              value={colorScheme}
              onChange={(value) => setColorScheme(value as MantineColorScheme)}
              data={[
                { value: 'auto', label: t('theme.auto') },
                { value: 'light', label: t('theme.light') },
                { value: 'dark', label: t('theme.dark') },
              ]}
            />
          </Group>
        </Stack>
      </Card>
    </Center>
  );
}
