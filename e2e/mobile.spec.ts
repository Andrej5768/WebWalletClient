import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

// A signed-in session with two accounts and an empty feed; anything else answers 404.
async function mockSignedInApi(page: Page) {
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
          { id: 2, name: 'Готівка', type: 'CASH', currency: 'UAH', balance: 1500, balanceInBase: 1500 },
        ]);
      case 'GET /api/v1/accounts/summary':
        return reply(200, {
          currency: 'UAH',
          netWorth: 1181493.12,
          available: 19952.37,
          availableWithCredit: 19952.37,
          readyToAssign: 4250,
        });
      case 'GET /api/v1/categories':
      case 'GET /api/v1/payees':
      case 'GET /api/v1/tags':
      case 'GET /api/v1/recurring/occurrences':
      case 'GET /api/v1/transactions/transfer-pairs':
        return reply(200, []);
      case 'GET /api/v1/transactions':
        return reply(200, { items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 });
      default:
        return reply(404, {});
    }
  });
}

// A string, because the e2e code has no DOM types: the expression runs in the page.
const sidewaysScroll = (page: Page) =>
  page.evaluate<number>('document.documentElement.scrollWidth - document.documentElement.clientWidth');

test('works on a phone: the menu behind a button, nothing wider than the screen, a new transaction', async ({
  page,
}) => {
  await mockSignedInApi(page);
  await page.goto('/accounts');

  await expect(page.getByRole('heading', { name: 'Рахунки', level: 1 })).toBeVisible();
  await expect(page.getByText('Чорна картка')).toBeVisible();
  // A seven-digit balance is shown whole, not cut off
  await expect(page.getByText('1 181 493,12 ₴').first()).toBeVisible();
  expect(await sidewaysScroll(page)).toBe(0);

  await page.getByRole('button', { name: 'Меню' }).tap();
  const menu = page.getByRole('dialog');
  await menu.getByRole('link', { name: 'Операції' }).tap();
  await expect(page.getByRole('heading', { name: 'Операції', level: 1 })).toBeVisible();
  await expect(menu).toBeHidden();
  expect(await sidewaysScroll(page)).toBe(0);

  await page.getByRole('button', { name: 'Операція' }).tap();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Сума' })).toBeVisible();
});
