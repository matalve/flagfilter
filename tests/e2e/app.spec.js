const { test, expect } = require('@playwright/test');

test('app shell loads with search and reset controls', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Flagfilter/i);
  await expect(page.locator('#searchInput')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#resetFiltersButton')).toBeVisible();
  await expect(page.locator('.flag-card').first()).toBeVisible({ timeout: 15000 });
});
