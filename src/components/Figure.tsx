import { Card, Text } from '@mantine/core';

/** A labelled key number on a card. */
export function Figure({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: string;
  note?: string;
  className?: string;
}) {
  return (
    <Card withBorder radius="md" padding="md">
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
      <Text className={`num ${className ?? ''}`} fz={22} fw={600} mt={4}>
        {value}
      </Text>
      {note && (
        <Text size="xs" c="dimmed" mt={2}>
          {note}
        </Text>
      )}
    </Card>
  );
}

/** Thin horizontal bar for a share 0..1. */
export function ShareBar({ share, color }: { share: number; color?: string }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: 'var(--ww-subtle)',
        border: '1px solid var(--ww-border)',
        overflow: 'hidden',
      }}
      aria-hidden
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(1, share)) * 100}%`,
          height: '100%',
          background: color ?? 'var(--mantine-primary-color-filled)',
        }}
      />
    </div>
  );
}
