import { expect, test } from '@playwright/test';

test('the start page switches theme and language', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Клієнт у розробці' })).toBeVisible();

  await page.getByText('Темна').click();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');

  await page.getByText('ENG').click();
  await expect(page.getByRole('heading', { name: 'Client under construction' })).toBeVisible();
});
