const { test, expect } = require('@playwright/test');

async function gotoApp(page) {
  await page.goto('/');
  await expect(page.locator('.flag-card').first()).toBeVisible({ timeout: 15000 });
}

test.describe('Flagfilter UI flows', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('app shell loads with search and reset controls', async ({ page }) => {
    await expect(page).toHaveTitle(/Flagfilter/i);
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('#resetFiltersButton')).toBeVisible();
    await expect(page.locator('.flag-card').first()).toBeVisible();
  });

  test('search filters flags and slash focuses the search input', async ({ page }) => {
    const searchInput = page.locator('#searchInput');

    await searchInput.click();
    await expect(searchInput).toBeFocused();

    await searchInput.fill('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Sweden']);

    await page.locator('#resetFiltersButton').click();
    await expect(searchInput).toHaveValue('');

    await page.locator('body').click();
    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();
  });

  test('reset clears a search and restores the full grid', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    const resetButton = page.locator('#resetFiltersButton');
    const initialCards = await page.locator('.flag-card').count();

    await searchInput.fill('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);

    await resetButton.click();

    await expect(searchInput).toHaveValue('');
    await expect(page.locator('.flag-card')).toHaveCount(initialCards);
  });

  test('switching to Spanish updates key UI labels', async ({ page }) => {
    await page.locator('#languageSelect').selectOption('es');

    await expect(page.locator('#resetFiltersButton')).toContainText('Reiniciar');
    await expect(page.locator('.filter-section').first()).toContainText('Filtrar por color');
    await expect(page.locator('.learn-more-btn').first()).toHaveText('Saber más');
  });

  test('learn more opens a flag modal with details', async ({ page }) => {
    await page.locator('.learn-more-btn').first().click();

    await expect(page.locator('#flagModalTitle')).toBeVisible();
    await expect(page.locator('.wiki-link')).toBeVisible();
    await expect(page.locator('.modal .close-btn').last()).toBeVisible();
  });
});
