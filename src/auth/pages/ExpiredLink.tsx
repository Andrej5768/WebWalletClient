import { Button, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Link2Off } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** "Oops!" screen for a used or expired email link. */
export function ExpiredLink({
  text,
  action,
  children,
}: {
  text: string;
  action?: { to: string; label: string };
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="md">
      <Group gap={14}>
        <ThemeIcon size={48} radius="md" color="yellow" variant="light" aria-hidden>
          <Link2Off size={24} />
        </ThemeIcon>
        <Text ff="heading" fw={600} fz={36} lh={1}>
          {t('auth.expired.oops')}
        </Text>
      </Group>
      <Title order={1} size="h2">
        {t('auth.expired.title')}
      </Title>
      <Text c="dimmed">{text}</Text>
      {children}
      {action && (
        <Button component={Link} to={action.to} fullWidth size="md">
          {action.label}
        </Button>
      )}
    </Stack>
  );
}
