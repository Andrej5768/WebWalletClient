import { ThemeIcon } from '@mantine/core';
import { ArrowLeftRight, CircleHelp } from 'lucide-react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { mantineColor, type PaletteColor } from '../lib/palette';

interface Props {
  icon?: string | null;
  color?: PaletteColor | null;
  size?: number;
  /** Shown for transfers, which have no category. */
  transfer?: boolean;
}

/** Category icon in a tinted tile; the icon is a Lucide name loaded on demand. */
export function CategoryIcon({ icon, color, size = 32, transfer }: Props) {
  const glyph = size * 0.5;
  return (
    <ThemeIcon
      variant="light"
      color={transfer ? 'gray' : mantineColor(color)}
      size={size}
      radius="md"
      aria-hidden
    >
      {transfer ? (
        <ArrowLeftRight size={glyph} />
      ) : icon ? (
        <DynamicIcon name={icon as IconName} size={glyph} fallback={() => <CircleHelp size={glyph} />} />
      ) : (
        <CircleHelp size={glyph} />
      )}
    </ThemeIcon>
  );
}
