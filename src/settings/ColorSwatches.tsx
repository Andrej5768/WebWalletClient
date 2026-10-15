import { CheckIcon, ColorSwatch, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { RadioTiles, type RadioTile } from '../components/RadioTiles';
import { mantineColor, paletteColors, type PaletteColor } from '../lib/palette';

/** Picks one of the twelve palette colors, or none. */
export function ColorSwatches({
  value,
  onChange,
  allowNone,
}: {
  value: PaletteColor | null;
  onChange(color: PaletteColor | null): void;
  allowNone?: boolean;
}) {
  const { t } = useTranslation();
  const options: RadioTile<PaletteColor | null>[] = [
    ...(allowNone
      ? [
          {
            value: null,
            label: t('settings.noColor'),
            render: (selected: boolean) => (
              <ColorSwatch
                color="var(--ww-subtle)"
                size={26}
                style={{ border: '1px dashed var(--ww-border-strong)' }}
              >
                {selected ? <CheckIcon size={10} /> : <Text size="xs">∅</Text>}
              </ColorSwatch>
            ),
          },
        ]
      : []),
    ...paletteColors.map((color) => ({
      value: color,
      label: t(`settings.colors.${color}`),
      render: (selected: boolean) => (
        <ColorSwatch color={`var(--mantine-color-${mantineColor(color)}-filled)`} size={26}>
          {selected && <CheckIcon size={10} color="white" />}
        </ColorSwatch>
      ),
    })),
  ];
  return (
    <RadioTiles
      label={t('settings.color')}
      options={options}
      value={value}
      onChange={onChange}
      style={{ gap: 8 }}
    />
  );
}
