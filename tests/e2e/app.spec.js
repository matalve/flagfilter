const { test, expect } = require('@playwright/test');

async function gotoApp(page, language = 'en') {
  await page.goto(`/?lang=${language}`);
  await expect(page.locator('.flag-card').first()).toBeVisible({ timeout: 15000 });
}

async function openFirstFlagModal(page) {
  await page.locator('.learn-more-btn').first().click();
  await expect(page.locator('#flagModalTitle')).toBeVisible();
}

test.describe('Flagfilter UI flows', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page, 'en');
  });

  test('app shell loads with search and reset controls', async ({ page }) => {
    await expect(page).toHaveTitle(/Flagfilter/i);
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('#resetFiltersButton')).toBeVisible();
    await expect(page.locator('.flag-card').first()).toBeVisible();
  });

  test('search filters flags and slash focuses the search input', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    const resetButton = page.locator('#resetFiltersButton');

    await searchInput.click();
    await expect(searchInput).toBeFocused();

    await searchInput.fill('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Sweden']);

    await page.locator('#resetFiltersButton').click();
    await expect(searchInput).toHaveValue('');

    await resetButton.focus();
    await expect(resetButton).toBeFocused();
    await expect(searchInput).not.toBeFocused();

    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();
  });

  test('color filters reduce the visible flag set', async ({ page }) => {
    const blackFilter = page.locator('.filter-btn[data-color="black"]');
    const initialCards = await page.locator('.flag-card').count();

    await blackFilter.click();
    await expect(blackFilter).toHaveClass(/active/);

    await expect.poll(async () => page.locator('.flag-card').count()).toBeGreaterThan(0);
    await expect.poll(async () => page.locator('.flag-card').count()).toBeLessThan(initialCards);
  });

  test('reset clears combined search and filter state', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    const yellowFilter = page.locator('.filter-btn[data-color="yellow"]');
    const resetButton = page.locator('#resetFiltersButton');
    const initialCards = await page.locator('.flag-card').count();

    await searchInput.fill('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);

    await yellowFilter.click();
    await expect(yellowFilter).toHaveClass(/active/);
    await expect(page.locator('.flag-card')).toHaveCount(1);

    await resetButton.click();

    await expect(searchInput).toHaveValue('');
    await expect(yellowFilter).not.toHaveClass(/active/);
    await expect(page.locator('.flag-card')).toHaveCount(initialCards);
  });

  test('switching to Spanish updates key UI labels', async ({ page }) => {
    await page.locator('#languageSelect').selectOption('es');

    await expect(page.locator('#resetFiltersButton')).toContainText('Reiniciar');
    await expect(page.locator('.filter-section').first()).toContainText('Filtrar por color');
    await expect(page.locator('.learn-more-btn').first()).toHaveText('Saber más');
  });

  test('learn more opens a flag modal and escape closes it', async ({ page }) => {
    const learnMoreButton = page.locator('.learn-more-btn').first();

    await learnMoreButton.click();
    await expect(page.locator('#flagModalTitle')).toBeVisible();
    await expect(page.locator('.wiki-link')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#flagModalTitle')).toHaveCount(0);
    await expect(learnMoreButton).toBeFocused();
  });

  test('modal close button closes the flag modal', async ({ page }) => {
    await page.locator('.learn-more-btn').first().click();

    const modalCloseButton = page.locator('.modal .close-btn').last();
    await expect(modalCloseButton).toBeVisible();
    await modalCloseButton.click();

    await expect(page.locator('#flagModalTitle')).toHaveCount(0);
  });

  test('report issue opens the form and cancel restores the trigger button', async ({ page }) => {
    await openFirstFlagModal(page);

    const reportButton = page.locator('.report-issue-btn');
    const reportFormPanel = page.locator('#reportFormPanel');

    await reportButton.click();
    await expect(reportFormPanel).toBeVisible();
    await expect(page.locator('#issueType')).toBeFocused();
    await expect(reportButton).toBeHidden();

    await page.locator('.cancel-btn').click();
    await expect(reportFormPanel).toBeHidden();
    await expect(reportButton).toBeVisible();
    await expect(reportButton).toBeFocused();
  });

  test('report issue success without GitHub URL shows only the base success message', async ({ page }) => {
    await page.route('**/api/report-issue', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          partial: false,
          destinations: {
            telegram: true,
            github: false
          },
          githubIssueUrl: null
        })
      });
    });

    await openFirstFlagModal(page);
    await page.locator('.report-issue-btn').click();

    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('Automated test report.');
    await page.locator('.submit-btn').click();

    const statusBox = page.locator('.report-form-status.success');
    await expect(statusBox).toContainText('Thank you for your report! We will review it soon.');
    await expect(statusBox).not.toContainText('GitHub issue was automatically created.');
    await expect(statusBox.getByRole('link', { name: 'View GitHub issue' })).toHaveCount(0);
  });

  test('report issue success with GitHub URL shows follow-up text and link', async ({ page }) => {
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

    await openFirstFlagModal(page);
    await page.locator('.report-issue-btn').click();

    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('Automated test report with issue link.');
    await page.locator('.submit-btn').click();

    const statusBox = page.locator('.report-form-status.success');
    await expect(statusBox).toContainText('Thank you for your report! We will review it soon.');
    await expect(statusBox).toContainText('GitHub issue was automatically created.');
    await expect(statusBox.getByRole('link', { name: 'View GitHub issue' }))
      .toHaveAttribute('href', 'https://github.com/matalve/flagfilter/issues/123');
  });
});
