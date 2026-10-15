import { CheckIcon, ColorSwatch, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
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
  return (
    <Group gap={8} role="radiogroup" aria-label={t('settings.color')}>
      {allowNone && (
        <UnstyledButton
          role="radio"
          aria-checked={value === null}
          aria-label={t('settings.noColor')}
          onClick={() => onChange(null)}
        >
          <ColorSwatch
            color="var(--ww-subtle)"
            size={26}
            style={{ border: '1px dashed var(--ww-border-strong)' }}
          >
            {value === null ? <CheckIcon size={10} /> : <Text size="xs">∅</Text>}
          </ColorSwatch>
        </UnstyledButton>
      )}
      {paletteColors.map((color) => (
        <Tooltip key={color} label={t(`settings.colors.${color}`)} withArrow openDelay={300}>
          <UnstyledButton
            role="radio"
            aria-checked={value === color}
            aria-label={t(`settings.colors.${color}`)}
            onClick={() => onChange(color)}
          >
            <ColorSwatch color={`var(--mantine-color-${mantineColor(color)}-filled)`} size={26}>
              {value === color && <CheckIcon size={10} color="white" />}
            </ColorSwatch>
          </UnstyledButton>
        </Tooltip>
      ))}
    </Group>
  );
}
