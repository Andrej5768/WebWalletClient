import { DateInput, type DateInputProps } from '@mantine/dates';
import { useState } from 'react';

/**
 * A date typed or picked as DD.MM.YYYY. Escape with the calendar open closes only the calendar: a modal or a drawer
 * listens for Escape on the whole window and skips it only when the focused element is marked so.
 */
export function DayInput({ popoverProps, ...props }: DateInputProps) {
  const [open, setOpen] = useState(false);
  return (
    <DateInput
      valueFormat="DD.MM.YYYY"
      {...props}
      data-mantine-stop-propagation={open ? 'true' : undefined}
      popoverProps={{
        ...popoverProps,
        onOpen: () => {
          setOpen(true);
          popoverProps?.onOpen?.();
        },
        onClose: () => {
          setOpen(false);
          popoverProps?.onClose?.();
        },
      }}
    />
  );
}
