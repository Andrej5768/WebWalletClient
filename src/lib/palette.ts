import type { Schemas } from '../api/client';

export type PaletteColor = NonNullable<Schemas['CategoryResponse']['color']>;

export const paletteColors: PaletteColor[] = [
  'blue',
  'green',
  'orange',
  'violet',
  'teal',
  'pink',
  'amber',
  'slate',
  'red',
  'indigo',
  'cyan',
  'lime',
];

const MANTINE: Record<PaletteColor, string> = {
  blue: 'blue',
  green: 'green',
  orange: 'orange',
  violet: 'violet',
  teal: 'teal',
  pink: 'pink',
  amber: 'yellow',
  slate: 'gray',
  red: 'red',
  indigo: 'indigo',
  cyan: 'cyan',
  lime: 'lime',
};

/** Colors given to categories that have none of their own; gray is left out, it reads as "no category". */
const AUTO_COLORS = paletteColors.filter((color) => color !== 'slate');

/** A stable color for a category without one, so that charts tell categories apart (e.g. imported ones). */
export function autoColor(id: number): PaletteColor {
  return AUTO_COLORS[Math.abs(id) % AUTO_COLORS.length]!;
}

/** Mantine color name for a palette color stored by the backend. */
export function mantineColor(color: PaletteColor | null | undefined, fallback = 'gray'): string {
  return color ? MANTINE[color] : fallback;
}
