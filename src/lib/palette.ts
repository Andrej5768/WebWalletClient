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

/** Mantine color name for a palette color stored by the backend. */
export function mantineColor(color: PaletteColor | null | undefined, fallback = 'gray'): string {
  return color ? MANTINE[color] : fallback;
}
