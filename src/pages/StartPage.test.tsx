import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { theme } from '../theme/theme';
import { StartPage } from './StartPage';

function renderPage() {
  return render(
    <MantineProvider theme={theme}>
      <StartPage />
    </MantineProvider>,
  );
}

afterEach(async () => {
  await i18n.changeLanguage('uk');
});

it('switches the language', async () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Клієнт у розробці' })).toBeInTheDocument();

  await userEvent.click(screen.getByText('ENG'));

  expect(screen.getByRole('heading', { name: 'Client under construction' })).toBeInTheDocument();
});
