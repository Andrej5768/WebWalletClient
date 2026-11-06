import { DateInput } from '@mantine/dates';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';

function typeDate(text: string) {
  const onChange = vi.fn();
  renderWithProviders(<DateInput label="Дата" valueFormat="DD.MM.YYYY" onChange={onChange} />);
  return { onChange, type: () => userEvent.type(screen.getByLabelText('Дата'), text) };
}

describe('typed dates', () => {
  it('reads the day first, as the field shows it', async () => {
    const { onChange, type } = typeDate('03.11.2026');
    await type();
    expect(onChange).toHaveBeenLastCalledWith('2026-11-03');
  });

  it('accepts a day above twelve', async () => {
    const { onChange, type } = typeDate('13.10.2026');
    await type();
    expect(onChange).toHaveBeenLastCalledWith('2026-10-13');
  });
});
