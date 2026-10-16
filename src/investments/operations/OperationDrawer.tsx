import { Drawer, Text } from '@mantine/core';

/**
 * Side panel to record or edit an operation of a brokerage account. Placeholder of the skeleton; filled in by the
 * operations part.
 */
export function OperationDrawer({
  onClose,
}: {
  operationId: number | null;
  accountId?: number;
  instrumentId?: number;
  onClose(): void;
}) {
  return (
    <Drawer opened onClose={onClose} position="right" size={560}>
      <Text c="dimmed">…</Text>
    </Drawer>
  );
}
