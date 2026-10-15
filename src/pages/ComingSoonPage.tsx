import { Card, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/** Placeholder for a section that a later roadmap step fills in. */
export function ComingSoonPage({ section }: { section: string }) {
  const { t } = useTranslation();
  return (
    <Stack gap="lg" maw={1200}>
      <Title order={1} size="h2">
        {t(`nav.${section}`)}
      </Title>
      <Card
        withBorder
        radius="md"
        mih={240}
        style={{ borderStyle: 'dashed', display: 'grid', placeItems: 'center' }}
      >
        <Stack gap={4} align="center">
          <Text fw={500}>{t('comingSoon.title')}</Text>
          <Text size="sm" c="dimmed">
            {t('comingSoon.text')}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
