const { test, expect } = require('@playwright/test');

async function gotoApp(page, language = 'en', query = '') {
  const params = new URLSearchParams({ lang: language });
  if (query) {
    params.set('q', query);
  }

  await page.goto(`/?${params.toString()}`);
  await expect(page.locator('.flag-card').first()).toBeVisible({ timeout: 15000 });
}

async function openFirstFlagModal(page) {
  await page.locator('.learn-more-btn').first().click();
  await expect(page.locator('#flagModalTitle')).toBeVisible();
}

async function openFlagModalBySearch(page, searchTerm) {
  const searchInput = page.locator('#searchInput');
  await searchInput.fill(searchTerm);
  await expect(page.locator('.flag-card')).toHaveCount(1);
  await page.locator('.learn-more-btn').click();
  await expect(page.locator('#flagModalTitle')).toBeVisible();
}

async function waitForNextTask(page) {
  await page.evaluate(() => new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  }));
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

  test('q URL parameter activates matching filter buttons and keeps remaining search text', async ({ page }) => {
    await gotoApp(page, 'en', 'blue sweden');

    await expect(page.locator('#searchInput')).toHaveValue('sweden');
    await expect(page.locator('.filter-btn[data-color="blue"]')).toHaveClass(/active/);
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Sweden']);
  });

  test('reset clears q URL parameter and query-applied filters', async ({ page }) => {
    await gotoApp(page, 'en', 'blue sweden');

    await page.locator('#resetFiltersButton').click();

    await expect(page.locator('#searchInput')).toHaveValue('');
    await expect(page.locator('.filter-btn[data-color="blue"]')).not.toHaveClass(/active/);
    await expect.poll(async () => new URL(await page.url()).searchParams.get('q')).toBeNull();
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

  test('flag image alt text is localized', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    const flagImage = page.locator('.flag-card img');

    await searchInput.fill('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(flagImage).toHaveAttribute('alt', 'Flag of Sweden');

    await page.locator('#languageSelect').selectOption('es');
    await expect(flagImage).toHaveAttribute('alt', 'Bandera de Suecia');
  });

  test('English q search still works when the page is opened in Spanish', async ({ page }) => {
    await gotoApp(page, 'es', 'sweden');

    await expect(page.locator('#searchInput')).toHaveValue('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Suecia']);
  });

  test('q keeps accented text in the search field', async ({ page }) => {
    await gotoApp(page, 'es', 'españa');

    await expect(page.locator('#searchInput')).toHaveValue('españa');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['España']);
  });

  test('q keeps hyphenated text in the search field', async ({ page }) => {
    await gotoApp(page, 'en', 'timor-leste');

    await expect(page.locator('#searchInput')).toHaveValue('timor-leste');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Timor-Leste (East Timor)']);
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

  test('grid flag images declare explicit dimensions to avoid layout shift', async ({ page }) => {
    const flagImage = page.locator('.flag-card img').first();
    await expect(flagImage).toHaveAttribute('width', '320');
    await expect(flagImage).toHaveAttribute('height', '213');
  });

  test('modal flag image dimensions follow the flag proportion', async ({ page }) => {
    // Sweden is 5:8, so the 320px-wide flagcdn image is 200px tall.
    await openFlagModalBySearch(page, 'sweden');

    const modalImage = page.locator('.modal-flag-image');
    await expect(modalImage).toHaveAttribute('width', '320');
    await expect(modalImage).toHaveAttribute('height', '200');
  });

  test('first flag image is eager and high priority for LCP, later ones stay lazy', async ({ page }) => {
    const firstImage = page.locator('.flag-card img').first();
    await expect(firstImage).toHaveAttribute('fetchpriority', 'high');
    await expect(firstImage).toHaveAttribute('loading', 'eager');

    // An image well past the above-the-fold batch is lazy and not prioritized.
    const laterImage = page.locator('.flag-card img').nth(20);
    await expect(laterImage).toHaveAttribute('loading', 'lazy');
    await expect(laterImage).not.toHaveAttribute('fetchpriority', 'high');
  });

  test('eager/high-priority image follows the initial ?q= filter, not the unfiltered list', async ({ page }) => {
    // On a filtered landing the grid renders once already-filtered, so the
    // prioritized LCP image is the filtered first flag (Sweden), not Andorra.
    await gotoApp(page, 'en', 'blue sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);

    const firstImage = page.locator('.flag-card img').first();
    await expect(firstImage).toHaveAttribute('alt', 'Flag of Sweden');
    await expect(firstImage).toHaveAttribute('fetchpriority', 'high');
    await expect(firstImage).toHaveAttribute('loading', 'eager');
  });

  test('flag images are served as WebP', async ({ page }) => {
    await expect(page.locator('.flag-card img').first())
      .toHaveAttribute('src', /flagcdn\.com\/w320\/[a-z]+\.webp$/);
  });

  test('the first flag is preloaded as the LCP image and matches its grid src', async ({ page }) => {
    const preload = page.locator('link[rel="preload"][as="image"]');
    await expect(preload).toHaveAttribute('href', 'https://flagcdn.com/w320/ad.webp');
    await expect(preload).toHaveAttribute('fetchpriority', 'high');

    // The preload must match the rendered src exactly, otherwise the browser fetches twice.
    await expect(page.locator('.flag-card img').first())
      .toHaveAttribute('src', 'https://flagcdn.com/w320/ad.webp');
  });

  test('heading levels never skip a level (accessibility heading order)', async ({ page }) => {
    const levels = await page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
        .filter((heading) => heading.getClientRects().length > 0)
        .map((heading) => Number(heading.tagName[1]))
    );

    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  test('the page content is wrapped in a single main landmark', async ({ page }) => {
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main #flagGrid')).toHaveCount(1);
  });

  test('filter section heading wraps the toggle and collapse still works', async ({ page }) => {
    // "More filters" is collapsed by default, hiding its <h3> group headings.
    const groupHeading = page.locator('.compact-filter-group h3').first();
    await expect(groupHeading).toBeHidden();

    await page.locator('.filter-section[data-section-id="more"] .filter-header').click();
    await expect(groupHeading).toBeVisible();
  });

  test('modal Colors line reflects the flag color tags', async ({ page }) => {
    // Argentina gained "yellow" (Sun of May) when the reported color tags were fixed.
    await openFlagModalBySearch(page, 'argentina');
    const argentinaColors = page.locator('.flag-info-details p', { hasText: 'Colors:' });
    await expect(argentinaColors).toContainText('yellow');
  });

  test('modal Colors line surfaces brown for the Cocos Islands', async ({ page }) => {
    // "brown" was promoted to a recognized color so the Cocos palm tree shows up.
    await openFlagModalBySearch(page, 'cocos');
    const cocosColors = page.locator('.flag-info-details p', { hasText: 'Colors:' });
    await expect(cocosColors).toContainText('brown');
  });

  test('English modal content renders inline flag links', async ({ page }) => {
    await openFlagModalBySearch(page, 'sweden');

    const denmarkLink = page.locator('.flag-info-details .flag-link', { hasText: 'Denmark' });
    await expect(denmarkLink).toBeVisible();
    await expect(denmarkLink).toHaveAttribute('data-flag-code', 'dk');
  });

  test('Spanish modal inline flag links open the linked flag modal', async ({ page }) => {
    await gotoApp(page, 'es');
    await openFlagModalBySearch(page, 'suecia');

    const denmarkLink = page.locator('.flag-info-details .flag-link', { hasText: 'Dinamarca' });
    await expect(denmarkLink).toBeVisible();

    await waitForNextTask(page);
    await denmarkLink.click();
    await expect(page.locator('#flagModalTitle')).toHaveText('Dinamarca');
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

  test('report issue error shows error message and no GitHub link', async ({ page }) => {
    await page.route('**/api/report-issue', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to send report'
        })
      });
    });

    await openFirstFlagModal(page);
    await page.locator('.report-issue-btn').click();

    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('Automated error-state test.');
    await page.locator('.submit-btn').click();

    const statusBox = page.locator('.report-form-status.error');
    await expect(statusBox).toContainText('Sorry, there was an error submitting your report. Please try again later.');
    await expect(statusBox.getByRole('link', { name: 'View GitHub issue' })).toHaveCount(0);
    await expect(page.locator('#reportFormPanel')).toBeVisible();
  });

  test('cancel clears prior error state and restores the report button', async ({ page }) => {
    await page.route('**/api/report-issue', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to send report'
        })
      });
    });

    await openFirstFlagModal(page);

    const reportButton = page.locator('.report-issue-btn');
    await reportButton.click();

    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('Automated cancel-after-error test.');
    await page.locator('.submit-btn').click();
    await expect(page.locator('.report-form-status.error')).toBeVisible();

    await page.locator('.cancel-btn').click();
    await expect(page.locator('#reportFormPanel')).toBeHidden();
    await expect(page.locator('.report-form-status')).toBeHidden();
    await expect(reportButton).toBeVisible();
    await expect(reportButton).toBeFocused();
  });

  test('report form can recover after an error and then show success', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/api/report-issue', async (route) => {
      requestCount += 1;

      if (requestCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Failed to send report'
          })
        });
        return;
      }

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
    await page.locator('#issueDescription').fill('First attempt should fail.');
    await page.locator('.submit-btn').click();
    await expect(page.locator('.report-form-status.error')).toBeVisible();

    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('Second attempt should succeed.');
    await page.locator('.submit-btn').click();

    const successBox = page.locator('.report-form-status.success');
    await expect(successBox).toContainText('Thank you for your report! We will review it soon.');
    await expect(successBox).not.toContainText('GitHub issue was automatically created.');
    await expect(page.locator('#issueType')).toBeFocused();
  });
});
