import { Text } from '@mantine/core';

/** Placeholder of the skeleton; filled in by its part. */
export function DividendsTab({ accountId }: { accountId?: number }) {
  return <Text c="dimmed">{accountId ?? '…'}</Text>;
}
