import { Tooltip, UnstyledButton } from '@mantine/core';
import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

export interface RadioTile<T> {
  value: T;
  label: string;
  render(selected: boolean): ReactNode;
}

/**
 * A radio group of small tiles (icons, colors) with one tab stop: arrow keys, Home and End move and
 * select, as in a native radio group.
 */
export function RadioTiles<T>({
  label,
  options,
  value,
  onChange,
  style,
}: {
  label: string;
  options: RadioTile<T>[];
  value: T;
  onChange(value: T): void;
  style?: CSSProperties;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusable = selectedIndex >= 0 ? selectedIndex : 0;

  const move = (event: KeyboardEvent, index: number) => {
    const last = options.length - 1;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Tooltip key={String(option.value)} label={option.label} withArrow openDelay={400}>
            <UnstyledButton
              ref={(element) => {
                refs.current[index] = element;
              }}
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              tabIndex={index === focusable ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => move(event, index)}
              style={{ borderRadius: 8 }}
            >
              {option.render(selected)}
            </UnstyledButton>
          </Tooltip>
        );
      })}
    </div>
  );
}
