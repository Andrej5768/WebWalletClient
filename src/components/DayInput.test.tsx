import { Modal } from '@mantine/core';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { DayInput } from './DayInput';

it('closes only the calendar on Escape, and the modal on the next Escape', async () => {
  const onClose = vi.fn();
  renderWithProviders(
    <Modal opened onClose={onClose} title="Ціль">
      <DayInput label="Дата" />
    </Modal>,
  );

  await userEvent.click(await screen.findByLabelText('Дата'));
  await waitFor(() =>
    expect(screen.getByLabelText('Дата')).toHaveAttribute('data-mantine-stop-propagation', 'true'),
  );
  await userEvent.keyboard('{Escape}');
  expect(onClose).not.toHaveBeenCalled();

  await waitFor(() =>
    expect(screen.getByLabelText('Дата')).not.toHaveAttribute('data-mantine-stop-propagation'),
  );
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
});
