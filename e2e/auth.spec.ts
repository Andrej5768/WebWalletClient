import { expect, test, type Page } from '@playwright/test';

// The backend is mocked with route handlers; these tests check the browser flow, not the API.
async function mockSignedOutApi(page: Page) {
  let signedIn = false;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const key = `${route.request().method()} ${url.pathname}`;
    const reply = (status: number, body?: unknown) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: body === undefined ? '' : JSON.stringify(body),
      });

    switch (key) {
      case 'POST /api/v1/auth/refresh':
        return signedIn
          ? reply(200, { accessToken: 't', tokenType: 'Bearer', expiresIn: 900 })
          : reply(401, {});
      case 'POST /api/v1/auth/login':
        signedIn = true;
        return reply(200, { accessToken: 't', tokenType: 'Bearer', expiresIn: 900 });
      case 'GET /api/v1/me':
        return reply(200, {
          email: 'olena@example.com',
          firstName: 'Олена',
          lastName: 'Коваль',
          locale: 'uk',
        });
      case 'GET /api/v1/accounts':
        return reply(200, [
          {
            id: 1,
            name: 'Чорна картка',
            type: 'CARD',
            currency: 'UAH',
            balance: 18452.37,
            balanceInBase: 18452.37,
          },
          {
            id: 2,
            name: 'Банка «Відпустка»',
            type: 'SAVINGS',
            currency: 'UAH',
            balance: 32000,
            balanceInBase: 32000,
          },
        ]);
      case 'GET /api/v1/accounts/summary':
        return reply(200, {
          currency: 'UAH',
          netWorth: 181493.12,
          available: 102913.27,
          availableWithCredit: 119493.12,
          readyToAssign: 4250,
        });
      default:
        return reply(404, {});
    }
  });
}

test('signs in and shows the app shell with the balance', async ({ page }) => {
  await mockSignedOutApi(page);
  await page.goto('/accounts');

  await expect(page.getByRole('heading', { name: 'Вхід' })).toBeVisible();
  await page.getByLabel('Електронна пошта').fill('olena@example.com');
  await page.getByLabel('Пароль').fill('secret-password');
  await page.getByRole('button', { name: 'Увійти' }).click();

  await expect(page.getByRole('heading', { name: 'Рахунки' })).toBeVisible();
  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByText('181 493,12 ₴')).toBeVisible();

  await sidebar.getByText('Чистий капітал').click();
  await page.getByRole('menuitem', { name: 'Вільно поза конвертами' }).click();
  await expect(sidebar.getByText('4 250,00 ₴')).toBeVisible();

  await page.getByRole('button', { name: 'Згорнути або розгорнути меню' }).click();
  await expect(sidebar.getByText('4 250,00 ₴')).toBeHidden();
});

test('switches the theme on the sign-in page', async ({ page }) => {
  await mockSignedOutApi(page);
  await page.goto('/login');

  await page.getByLabel('Темна').click();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
});
