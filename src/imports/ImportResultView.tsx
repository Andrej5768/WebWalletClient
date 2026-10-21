import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** What an import did: a tile per count, optional notes below them, and the way to the imported data. */
export function ImportResultView({
  stats,
  link,
  onClose,
  children,
}: {
  stats: { key: string; label: string; value: number }[];
  link: { to: string; label: string };
  onClose(): void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {stats.map(({ key, label, value }) => (
          <Stack key={key} gap={2} p="sm" style={{ border: '1px solid var(--ww-border)', borderRadius: 8 }}>
            <Text className="num" fz={22} fw={600}>
              {value}
            </Text>
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
      {children}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose}>
          {t('imports.result.close')}
        </Button>
        <Button component={Link} to={link.to} onClick={onClose}>
          {link.label}
        </Button>
      </Group>
    </Stack>
  );
}
