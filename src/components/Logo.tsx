import { Group, Text, ThemeIcon } from '@mantine/core';
import { Wallet } from 'lucide-react';

export function Logo({ withText = true }: { withText?: boolean }) {
  return (
    <Group gap={10} wrap="nowrap">
      <ThemeIcon size={26} radius="sm" aria-hidden>
        <Wallet size={15} strokeWidth={2} />
      </ThemeIcon>
      {withText && (
        <Text fw={600} size="15px">
          WebWallet
        </Text>
      )}
    </Group>
  );
}
