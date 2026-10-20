import { Card, Text, Tooltip } from '@mantine/core';
import classes from './Figure.module.css';

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

/**
 * Thin horizontal bar for a share 0..1, optionally with a marker (e.g. today in the month, the expected pace) and
 * ticks with labels under the bar (e.g. milestones). The bar is decoration: the numbers are written next to it.
 */
export function ShareBar({
  share,
  color,
  marker,
  markerTitle,
  ticks,
  height = 6,
}: {
  share: number;
  color?: string;
  /** Position 0..1 of a vertical mark across the bar; null or undefined for none. */
  marker?: number | null;
  /** Shown when the pointer is on the marker. */
  markerTitle?: string;
  ticks?: { position: number; label: string }[];
  height?: number;
}) {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  return (
    <div
      className={`${classes.bar} ${ticks?.length ? classes.withTicks : ''}`}
      style={{ height, borderRadius: height / 2 }}
      aria-hidden
    >
      <span
        className={classes.fill}
        style={{
          width: `${clamp(share) * 100}%`,
          background: color ?? 'var(--mantine-primary-color-filled)',
        }}
      />
      {marker != null &&
        (markerTitle ? (
          <Tooltip label={markerTitle} withArrow>
            <i className={classes.marker} style={{ left: `${clamp(marker) * 100}%` }} />
          </Tooltip>
        ) : (
          <i className={classes.marker} style={{ left: `${clamp(marker) * 100}%` }} />
        ))}
      {ticks?.map((tick) => (
        <i key={tick.label} className={classes.tick} style={{ left: `${clamp(tick.position) * 100}%` }}>
          <b>{tick.label}</b>
        </i>
      ))}
    </div>
  );
}
