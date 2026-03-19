const { test, expect } = require('@playwright/test');

async function waitForFlags(page) {
  await expect(page.locator('.flag-card').first()).toBeVisible({ timeout: 15000 });
}

test.describe('Flagfilter smoke flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForFlags(page);
  });

  test('search field can be clicked and focused, and slash focuses it too', async ({ page }) => {
    const searchInput = page.locator('#searchInput');

    await searchInput.click();
    await expect(searchInput).toBeFocused();

    await page.locator('body').click();
    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();
  });

  test('reset clears search and active filters', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    const resetButton = page.locator('#resetFiltersButton');
    const redFilter = page.locator('.filter-btn[data-color="red"]');
    const initialCards = await page.locator('.flag-card').count();

    await searchInput.fill('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);

    await redFilter.click();
    await expect(redFilter).toHaveClass(/active/);

    await resetButton.click();

    await expect(searchInput).toHaveValue('');
    await expect(redFilter).not.toHaveClass(/active/);
    await expect(page.locator('.flag-card')).toHaveCount(initialCards);
  });

  test('report issue success shows GitHub issue link when API returns it', async ({ page }) => {
    await page.route('**/api/report-issue', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          partial: false,
          destinations: {
            telegram: false,
            github: true
          },
          githubIssueUrl: 'https://github.com/matalve/flagfilter/issues/123'
        })
      });
    });

    await page.locator('.learn-more-btn').first().click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.locator('.report-issue-btn').click();
    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('Automated test report content.');
    await page.locator('.submit-btn').click();

    const messageBox = page.locator('.report-form-status.success');
    await expect(messageBox).toContainText('Thank you for your report! We will review it soon.');
    await expect(messageBox).toContainText('GitHub issue was automatically created.');

    const issueLink = messageBox.getByRole('link', { name: 'View GitHub issue' });
    await expect(issueLink).toHaveAttribute('href', 'https://github.com/matalve/flagfilter/issues/123');
  });

  test('switching to Spanish updates core UI copy', async ({ page }) => {
    await page.locator('#languageSelect').selectOption('es');

    await expect(page.locator('#resetFiltersButton')).toContainText('Reiniciar');
    await expect(page.locator('.filter-section').first()).toContainText('Filtrar por color');
    await expect(page.locator('.learn-more-btn').first()).toHaveText('Saber más');
  });
});
