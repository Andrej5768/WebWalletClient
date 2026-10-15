import { ThemeIcon } from '@mantine/core';
import { ArrowLeftRight, CircleHelp } from 'lucide-react';
import { CATEGORY_ICONS } from '../lib/categoryIcons';
import { mantineColor, type PaletteColor } from '../lib/palette';

interface Props {
  icon?: string | null;
  color?: PaletteColor | null;
  size?: number;
  /** Shown for transfers, which have no category. */
  transfer?: boolean;
}

/** Category icon in a tinted tile; an unknown icon name shows a question mark. */
export function CategoryIcon({ icon, color, size = 32, transfer }: Props) {
  const glyph = size * 0.5;
  const Icon = transfer ? ArrowLeftRight : ((icon ? CATEGORY_ICONS[icon] : undefined) ?? CircleHelp);
  return (
    <ThemeIcon
      variant="light"
      color={transfer ? 'gray' : mantineColor(color)}
      size={size}
      radius="md"
      aria-hidden
    >
      <Icon size={glyph} />
    </ThemeIcon>
  );
}
