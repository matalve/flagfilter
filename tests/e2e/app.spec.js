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

// Submitting a report loads Turnstile from challenges.cloudflare.com. Cloudflare
// is not what these tests exercise, and the test host is not one of the widget's
// allowed hostnames, so serve a stand-in that resolves the challenge immediately.
// It records how many widgets were rendered, which is what proves the challenge
// runs on submit rather than when the form opens.
const TURNSTILE_STUB = `
  (() => {
    const widgets = new Map();
    let nextId = 0;

    window.turnstile = {
      render(container, options) {
        window.__turnstileRenders += 1;
        const id = 'stub-' + (nextId += 1);
        widgets.set(id, options);
        return id;
      },
      execute(id) {
        const options = widgets.get(id);
        window.setTimeout(() => options && options.callback('stub-token-' + id), 10);
      },
      reset() {},
      remove(id) {
        widgets.delete(id);
      }
    };
  })();
`;

async function stubTurnstile(page) {
  await page.addInitScript(() => {
    window.__turnstileRenders = 0;
  });
  await page.route('**challenges.cloudflare.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: TURNSTILE_STUB
  }));
}

function createPhoneContext(browser, baseURL) {
  return browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
}

async function waitForNextTask(page) {
  await page.evaluate(() => new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  }));
}

test.describe('Flagfilter UI flows', () => {
  test.beforeEach(async ({ page }) => {
    await stubTurnstile(page);
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

  test('communism ideology filter is enabled and returns its tagged flags', async ({ page }) => {
    // Expand "More filters" (collapsed by default) to reach the ideology buttons.
    await page.locator('.filter-section[data-section-id="more"] .filter-header').click();

    const communism = page.locator('.filter-btn[data-ideology="communism"]');
    await expect(communism).toBeEnabled(); // was permanently disabled when no flag carried the tag
    await communism.click();

    await expect(page.locator('.flag-card')).not.toHaveCount(0);
    await expect(page.locator('.flag-card h3', { hasText: /^China$/ })).toHaveCount(1);
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

  test('the site title is a keyboard-focusable button', async ({ page }) => {
    const titleReset = page.locator('#titleReset');
    await expect(titleReset).toHaveRole('button');
    await expect(titleReset).toHaveText('Flagfilter');
    await titleReset.focus();
    await expect(titleReset).toBeFocused();
  });

  test('clicking the site title resets search, filters, expanded sections and the q URL parameter', async ({ page }) => {
    await gotoApp(page, 'en', 'blue sweden');
    await expect(page.locator('.filter-btn[data-color="blue"]')).toHaveClass(/active/);

    // Expand "More filters" (collapsed by default) to confirm the title also collapses it.
    const moreSection = page.locator('.filter-section[data-section-id="more"]');
    await moreSection.locator('.filter-header').click();
    await expect(moreSection).not.toHaveClass(/collapsed/);

    await page.locator('#titleReset').click();

    await expect(page.locator('#searchInput')).toHaveValue('');
    await expect(page.locator('.filter-btn[data-color="blue"]')).not.toHaveClass(/active/);
    await expect(moreSection).toHaveClass(/collapsed/);
    await expect.poll(async () => new URL(await page.url()).searchParams.get('q')).toBeNull();
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

  test('search folds diacritics on flag names', async ({ page }) => {
    // "sao tome" (no diacritics) must find "São Tomé and Príncipe". See #144.
    await page.locator('#searchInput').fill('sao tome');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['São Tomé and Príncipe']);
  });

  test('search with diacritics also matches', async ({ page }) => {
    await page.locator('#searchInput').fill('são tomé');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['São Tomé and Príncipe']);
  });

  test('search matches hyphenated names without the hyphen', async ({ page }) => {
    await page.locator('#searchInput').fill('timor leste');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Timor-Leste (East Timor)']);
  });

  test('search normalizes case and extra whitespace', async ({ page }) => {
    await page.locator('#searchInput').fill('  South   KOREA ');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['South Korea']);
  });

  test('Spanish UI search folds diacritics on translated names', async ({ page }) => {
    // "espana" (no tilde) must find "España" in the Spanish UI. See #144.
    await gotoApp(page, 'es');
    await page.locator('#searchInput').fill('espana');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['España']);
  });

  test('Spanish UI search also matches English base names', async ({ page }) => {
    // Language mixing: English query, Spanish UI — the base name is always searchable.
    await gotoApp(page, 'es');
    await page.locator('#searchInput').fill('ivory coast');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Costa de Marfil']);
  });

  test('Spanish UI search matches English multiword base names with punctuation', async ({ page }) => {
    await gotoApp(page, 'es');
    await page.locator('#searchInput').fill('sao tome');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['Santo Tomé y Príncipe']);
  });

  test('search uses the rebuilt haystack after a runtime language switch', async ({ page }) => {
    // Pins the invariant that switchLanguage re-runs rebuildFlags: without the
    // rebuild, the haystack keeps the English names and "espana" would still
    // find nothing after switching to Spanish. See #144.
    await page.locator('#searchInput').fill('espana');
    await expect(page.locator('.flag-card')).toHaveCount(0);
    await page.locator('#languageSelect').selectOption('es');
    await expect(page.locator('.flag-card')).toHaveCount(1);
    await expect(page.locator('.flag-card h3')).toHaveText(['España']);
  });

  test('search cannot match across field boundaries', async ({ page }) => {
    // "spain es" would match Spain if the name field flowed into the code
    // field; with sentinel-separated haystack fields it finds nothing. See #151.
    await page.locator('#searchInput').fill('spain es');
    await expect(page.locator('.flag-card')).toHaveCount(0);
    await expect(page.locator('.no-results')).toBeVisible();
  });

  test('Spanish UI search cannot match across the translated and base name', async ({ page }) => {
    // "espana spain" spans the localized-name and base-name fields. See #151.
    await gotoApp(page, 'es');
    await page.locator('#searchInput').fill('espana spain');
    await expect(page.locator('.flag-card')).toHaveCount(0);
    await expect(page.locator('.no-results')).toBeVisible();
  });

  test('search containing only punctuation shows the no-results message', async ({ page }) => {
    await page.locator('#searchInput').fill('!!!');
    await expect(page.locator('.flag-card')).toHaveCount(0);
    await expect(page.locator('.no-results')).toBeVisible();
  });

  test('clearing a punctuation-only search restores the full grid', async ({ page }) => {
    const initialCards = await page.locator('.flag-card').count();
    // Guard the precondition: without a rendered grid the restore assertion
    // below would pass vacuously.
    expect(initialCards).toBeGreaterThan(0);
    await page.locator('#searchInput').fill('!!!');
    await expect(page.locator('.flag-card')).toHaveCount(0);
    await page.locator('#searchInput').fill('');
    await expect(page.locator('.flag-card')).toHaveCount(initialCards);
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

  test('modal flag image uses a higher-resolution (w640) source than the grid', async ({ page }) => {
    // Grid stays w320 for performance; the modal uses w640 for a crisp detail view.
    await expect(page.locator('.flag-card img').first()).toHaveAttribute('src', /\/w320\//);
    await openFlagModalBySearch(page, 'sweden');
    await expect(page.locator('.modal-flag-image')).toHaveAttribute('src', /\/w640\/se\.webp$/);
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
    // prioritized LCP image is the filtered first flag (Sweden), not Afghanistan.
    await gotoApp(page, 'en', 'blue sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);

    const firstImage = page.locator('.flag-card img').first();
    await expect(firstImage).toHaveAttribute('alt', 'Flag of Sweden');
    await expect(firstImage).toHaveAttribute('fetchpriority', 'high');
    await expect(firstImage).toHaveAttribute('loading', 'eager');
  });

  test('every compact filter group lays its buttons out the same way', async ({ page }) => {
    // The layout selectors used to list each group by name, so a new group
    // landed with no layout at all: one button per line on a phone. See #141.
    await page.locator('.filter-section[data-section-id="more"] .filter-header').click();

    const displays = await page.locator('.compact-filter-group > div').evaluateAll(
      (containers) => containers.map((container) => ({
        className: container.className,
        display: getComputedStyle(container).display
      }))
    );

    expect(displays.length).toBeGreaterThan(1);
    displays.forEach(({ className, display }) => {
      // Continent keeps the grid from the shared rule; everything else is flex.
      expect(display, className).toBe(className.includes('continent') ? 'grid' : 'flex');
    });
  });

  test('flag family buttons show an example flag that survives a language switch', async ({ page }) => {
    // setButtonLabel() rebuilds a button's contents around its .icon element, so
    // the example flag has to carry that class or it disappears the first time
    // someone switches language. See #141.
    await page.locator('.filter-section[data-section-id="more"] .filter-header').click();

    const panArab = page.locator('.filter-btn[data-family="pan-arab"] img.flag-icon');
    await expect(panArab).toHaveAttribute('src', 'https://flagcdn.com/20x15/jo.webp');
    await expect(panArab).toHaveAttribute('alt', '');

    await page.locator('#languageSelect').selectOption('es');
    await expect(page.locator('.filter-btn[data-family="pan-arab"]')).toContainText('Panárabe');
    await expect(panArab).toHaveAttribute('src', 'https://flagcdn.com/20x15/jo.webp');
  });

  test('flag family filters read a curated tag, not the colour set', async ({ page }) => {
    // Pan-Slavic is the case that makes the point: as a colour query
    // (blue + white + red) it returns 81 flags, most of them not Slavic. The tag
    // says the flag belongs to the tradition. See #141.
    await page.locator('.filter-section[data-section-id="more"] .filter-header').click();

    const panSlavic = page.locator('.filter-btn[data-family="pan-slavic"]');
    await expect(panSlavic).toBeEnabled();
    await panSlavic.click();

    await expect(page.locator('.flag-card h3', { hasText: /^Croatia$/ })).toHaveCount(1);
    await expect(page.locator('.flag-card h3', { hasText: /^France$/ })).toHaveCount(0);
    await expect(page.locator('.flag-card h3', { hasText: /^United States$/ })).toHaveCount(0);
  });

  test('a family link in flag prose applies the family filter', async ({ page }) => {
    // These links were plain text until the family filters existed to receive
    // them: nothing resolved ?q=pan-arab, so the anchor was unwrapped.
    await openFlagModalBySearch(page, 'jordan');

    await page.locator('.flag-info-details a.filter-link', { hasText: 'Pan-Arab' }).click();

    await expect(page.locator('#flagModalTitle')).toHaveCount(0);
    await expect(page.locator('.filter-btn[data-family="pan-arab"]')).toHaveClass(/active/);
    await expect(page.locator('.flag-card h3', { hasText: /^Jordan$/ })).toHaveCount(1);
    await expect(page.locator('.flag-card h3', { hasText: /^Sweden$/ })).toHaveCount(0);
  });

  test('the flag family group is localized', async ({ page }) => {
    await gotoApp(page, 'es');
    await page.locator('.filter-section[data-section-id="more"] .filter-header').click();

    await expect(page.locator('.compact-filter-group h3', { hasText: 'Familia de banderas' })).toHaveCount(1);
    await expect(page.locator('.filter-btn[data-family="pan-african"]')).toContainText('Panafricana');
  });

  test('a filter link in flag prose stays a real ?q= link', async ({ page }) => {
    // These are how a reader discovers what else is filterable while reading, so
    // the anchor survives with its href intact — it works without JS and can be
    // opened in a new tab. See #141.
    await openFlagModalBySearch(page, 'sweden');

    const filterLink = page.locator('.flag-info-details a.filter-link', { hasText: 'cross' });
    await expect(filterLink).toHaveAttribute('href', '?q=cross');
  });

  test('following a filter link filters the grid without reloading', async ({ page }) => {
    await openFlagModalBySearch(page, 'sweden');

    // Pin the document so a full navigation would be visible as a reset.
    await page.evaluate(() => { window.__notReloaded = true; });

    await page.locator('.flag-info-details a.filter-link', { hasText: 'cross' }).click();

    // The modal gives way to the filtered grid, and the leftover search that
    // found Sweden is cleared — the link lands on exactly its own view.
    await expect(page.locator('#flagModalTitle')).toHaveCount(0);
    await expect(page.locator('.filter-btn[data-pattern="cross"]')).toHaveClass(/active/);
    await expect(page.locator('#searchInput')).toHaveValue('');
    await expect(page.locator('.flag-card')).not.toHaveCount(0);
    await expect.poll(async () => new URL(await page.url()).searchParams.get('q')).toBe('cross');

    expect(await page.evaluate(() => window.__notReloaded)).toBe(true);
  });

  test('flags are ordered by their displayed name, not by country code', async ({ page }) => {
    // In code order the grid opened Andorra, United Arab Emirates, Afghanistan —
    // "ae" landing second is baffling when the card reads United Arab Emirates.
    // People scan the name they can see. See #123.
    const names = await page.locator('.flag-card h3').allTextContents();

    expect(names.length).toBeGreaterThan(200);
    expect(names[0]).toBe('Afghanistan');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  test('the order re-sorts for the language being displayed', async ({ page }) => {
    await gotoApp(page, 'es');
    const names = await page.locator('.flag-card h3').allTextContents();

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    // Germany is "Alemania" in Spanish and sorts before Andorra — which cannot
    // happen in code order, where "ad" precedes "de".
    expect(names.indexOf('Alemania')).toBeLessThan(names.indexOf('Andorra'));
  });

  test('flag images are served as WebP', async ({ page }) => {
    await expect(page.locator('.flag-card img').first())
      .toHaveAttribute('src', /flagcdn\.com\/w320\/[a-z]+\.webp$/);
  });

  test('the first flag is preloaded as the LCP image and matches its grid src', async ({ page }) => {
    const preload = page.locator('link[rel="preload"][as="image"]');
    await expect(preload).toHaveAttribute('href', 'https://flagcdn.com/w320/af.webp');
    await expect(preload).toHaveAttribute('fetchpriority', 'high');

    // The preload must match the rendered src exactly, otherwise the browser fetches twice.
    await expect(page.locator('.flag-card img').first())
      .toHaveAttribute('src', 'https://flagcdn.com/w320/af.webp');
  });

  test('the icon set is declared and served', async ({ page, request }) => {
    // The whole set was deleted by the April 2025 rework, so this pins the head
    // markup and that the files behind it actually exist. See #138.
    await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute('href', '/favicon-32x32.png');
    await expect(page.locator('link[rel="icon"][sizes="16x16"]')).toHaveAttribute('href', '/favicon-16x16.png');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest');
    await expect(page.locator('link[rel="mask-icon"]')).toHaveAttribute('href', '/safari-pinned-tab.svg');

    for (const path of [
      '/favicon.ico',
      '/favicon-32x32.png',
      '/favicon-16x16.png',
      '/apple-touch-icon.png',
      '/android-chrome-192x192.png',
      '/android-chrome-512x512.png',
      '/safari-pinned-tab.svg',
      '/opengraph.png',
      '/site.webmanifest'
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      // /favicon.ico is requested by browsers whether or not anything links to
      // it; answering with the HTML page is the bug this closes.
      expect(response.headers()['content-type'], path).not.toContain('text/html');
    }
  });

  test('the manifest lists icons that exist', async ({ request }) => {
    const manifest = await (await request.get('/site.webmanifest')).json();

    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    }
  });

  test('social previews point at an absolute image URL', async ({ page }) => {
    // A relative og:image is why the original never rendered a preview: most
    // scrapers do not resolve it against the page URL. See #138.
    const image = page.locator('meta[property="og:image"]');
    await expect(image).toHaveAttribute('content', /^https:\/\//);
    await expect(image).toHaveAttribute('content', /opengraph\.png$/);
  });

  test('preconnects to the flag image host', async ({ page }) => {
    await expect(page.locator('link[rel="preconnect"][href="https://flagcdn.com"]')).toHaveCount(1);
  });

  test('the main script is a module (kept off the critical path)', async ({ page }) => {
    // Module scripts are deferred by default, so this keeps script.js off the
    // critical path just like the old defer attribute did. See #143.
    await expect(page.locator('script[src="script.js"][type="module"]')).toHaveCount(1);
  });

  test('renders icons as inline SVG, not Font Awesome', async ({ page }) => {
    await expect(page.locator('link[href*="font-awesome"]')).toHaveCount(0);
    await expect(page.locator('i.fas')).toHaveCount(0);
    // Sprite symbols exist and buttons reference them, including the chosen swaps.
    await expect(page.locator('svg symbol#i-hippo')).toHaveCount(1);
    await expect(page.locator('.filter-btn[data-continent="africa"] use')).toHaveAttribute('href', '#i-hippo');
    await expect(page.locator('.filter-btn[data-continent="southAmerica"] use')).toHaveAttribute('href', '#i-frog');
    await expect(page.locator('.filter-btn[data-ideology="buddhism"] use')).toHaveAttribute('href', '#i-dharmachakra');
    await expect(page.locator('.filter-btn[data-ideology="hinduism"] use')).toHaveAttribute('href', '#i-om');
  });

  test('dark mode toggle still works with inline-SVG icons', async ({ page }) => {
    await expect(page.locator('.dark-mode-toggle svg.sun-icon')).toHaveCount(1);
    await expect(page.locator('.dark-mode-toggle svg.moon-icon')).toHaveCount(1);

    // The dark-mode class lives on <html> (set before first paint) — see #143.
    const html = page.locator('html');
    const wasDark = await html.evaluate((el) => el.classList.contains('dark-mode'));
    await page.locator('#darkModeToggle').click();
    const nowDark = await html.evaluate((el) => el.classList.contains('dark-mode'));
    expect(nowDark).toBe(!wasDark);
  });

  test('applies a saved dark preference before the app script runs', async ({ page }) => {
    // The theme class must come from the inline snippet in <head>, not from the
    // deferred app script — that is what prevents a flash of the wrong theme.
    // Block script.js so only the snippet can have applied the class. See #143.
    await page.addInitScript(() => {
      window.localStorage.setItem('darkMode', 'true');
    });
    await page.route('**/script.js', (route) => route.abort());
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
  });

  test('falls back to the system theme when nothing is saved', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
  });

  test('a saved preference wins over the system theme', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('darkMode', 'false');
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/?lang=en');
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
  });

  test('tracks system theme changes until a preference is saved', async ({ page }) => {
    // beforeEach loaded the app with the default (light) scheme and no saved
    // preference, so the class follows the system live. See #143.
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);

    // Once the user picks a side, the choice is saved and wins over the system.
    // The class is currently off, so the toggle switches dark on and saves it.
    await page.locator('#darkModeToggle').click();
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
  });

  test('app initializes when MediaQueryList only has addListener (older Safari)', async ({ page }) => {
    // MediaQueryList gained addEventListener in Safari 14; before that only
    // addListener exists. initDarkMode must fall back instead of throwing and
    // aborting initApp before translations and flags load. See #143.
    await page.addInitScript(() => {
      MediaQueryList.prototype.addEventListener = undefined;
    });
    await gotoApp(page, 'en');

    await expect(page.locator('.flag-card').first()).toBeVisible();

    // The addListener fallback still tracks the system theme live.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
  });

  test('filter and reset icons stay inline SVG after a language switch', async ({ page }) => {
    await page.locator('#languageSelect').selectOption('es');
    // setButtonLabel re-attaches the SVG icon
    await expect(page.locator('.filter-btn[data-continent="africa"] use')).toHaveAttribute('href', '#i-hippo');
    // applyStaticTranslations rebuilds the reset button's inner HTML with the SVG icon
    await expect(page.locator('#resetFiltersButton svg.icon use')).toHaveAttribute('href', '#i-rotate-left');
  });

  test('every icon reference resolves to a sprite symbol', async ({ page }) => {
    // Guards the common regression: an icon is referenced but its <symbol> is
    // missing from the sprite (e.g. a new icon added without regenerating it).
    const { refCount, missing } = await page.evaluate(() => {
      const refs = [...document.querySelectorAll('use')]
        .map((u) => (u.getAttribute('href') || '').replace(/^#/, ''))
        .filter(Boolean);
      const symbols = new Set([...document.querySelectorAll('symbol')].map((s) => s.id));
      return { refCount: refs.length, missing: [...new Set(refs)].filter((id) => !symbols.has(id)) };
    });
    expect(refCount).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  test('no sprite symbol is empty (no blank icons)', async ({ page }) => {
    // Catches a botched sprite regeneration where a <symbol> exists but lost its geometry.
    const empty = await page.evaluate(() =>
      [...document.querySelectorAll('symbol')]
        .filter((s) => s.querySelector('path, polygon, circle, rect, g') === null)
        .map((s) => s.id)
    );
    expect(empty).toEqual([]);
  });

  test('a rendered icon has a non-zero size', async ({ page }) => {
    // Guards against a CSS regression collapsing .icon to 0×0.
    const box = await page.locator('#infoButton .icon').boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
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

  test('flag modal has an Amazon affiliate shop link with disclosure', async ({ page }) => {
    await openFlagModalBySearch(page, 'sweden');
    const shop = page.locator('.shop-link');
    await expect(shop).toHaveAttribute('href', 'https://www.amazon.com/s?k=Sweden%20flag&tag=flagfilter-20');
    await expect(shop).toHaveAttribute('rel', /sponsored/);
    await expect(page.locator('.affiliate-disclosure')).toContainText('Amazon Associate');
  });

  test('shop link uses the English flag name even in the Spanish UI', async ({ page }) => {
    await gotoApp(page, 'es');
    await openFlagModalBySearch(page, 'sweden');
    const shop = page.locator('.shop-link');
    await expect(shop).toHaveAttribute('href', /k=Sweden%20flag&tag=flagfilter-20/); // English search query
    await expect(shop).toContainText('Suecia'); // Spanish label
  });

  test('shop link strips parenthetical aliases from the search query', async ({ page }) => {
    await openFlagModalBySearch(page, 'timor-leste');
    await expect(page.locator('.shop-link'))
      .toHaveAttribute('href', 'https://www.amazon.com/s?k=Timor-Leste%20flag&tag=flagfilter-20');
  });

  test('modal Colors line reflects the flag color tags', async ({ page }) => {
    // Argentina gained "yellow" (Sun of May) when the reported color tags were fixed.
    await openFlagModalBySearch(page, 'argentina');
    const argentinaColors = page.locator('.flag-info-details p', { hasText: 'Colors:' });
    await expect(argentinaColors).toContainText('Yellow'); // localized label (was raw "yellow")
  });

  test('modal Colors line surfaces brown for the Cocos Islands', async ({ page }) => {
    // "brown" was promoted to a recognized color so the Cocos palm tree shows up.
    await openFlagModalBySearch(page, 'cocos');
    const cocosColors = page.locator('.flag-info-details p', { hasText: 'Colors:' });
    await expect(cocosColors).toContainText('Brown');
  });

  test('modal Colors line is localized in the Spanish UI', async ({ page }) => {
    await gotoApp(page, 'es');
    await openFlagModalBySearch(page, 'sweden');
    const colors = page.locator('.flag-info-details p', { hasText: 'Colores:' });
    await expect(colors).toContainText('Azul'); // localized, not the English "blue"
    await expect(colors).not.toContainText('blue');
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
    await expect(page.locator('.close-report-btn')).toBeFocused();
  });

  test('app still works when localStorage access is denied', async ({ page }) => {
    // Private mode / blocked storage (notably Safari) can make every
    // localStorage access throw; the app must degrade to no persistence
    // instead of aborting initApp. See #146.
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Access is denied', 'SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('Access is denied', 'SecurityError'); };
    });
    await gotoApp(page, 'en');

    await page.locator('#searchInput').fill('sweden');
    await expect(page.locator('.flag-card')).toHaveCount(1);

    await page.locator('#darkModeToggle').click();
    await expect(page.locator('html')).toHaveClass(/dark-mode/);

    const moreSection = page.locator('.filter-section[data-section-id="more"]');
    await moreSection.locator('.filter-header').click();
    await expect(moreSection).not.toHaveClass(/collapsed/);
  });

  test('report form caps description and email length', async ({ page }) => {
    // Mirrors the server-side length limits from #146 on the client side.
    await openFirstFlagModal(page);
    await page.locator('.report-issue-btn').click();

    await expect(page.locator('#issueDescription')).toHaveAttribute('maxlength', '2000');
    await expect(page.locator('#userEmail')).toHaveAttribute('maxlength', '254');
  });

  test('a sent report replaces the form with a receipt and a single Close button', async ({ page }) => {
    // Submit and Cancel describe nothing the reader can still do once the
    // report is on its way, so the form gives way to its receipt.
    await page.route('**/api/report-issue', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          partial: false,
          destinations: { telegram: true, github: false },
          githubIssueUrl: null
        })
      });
    });

    await openFirstFlagModal(page);
    await page.locator('.report-issue-btn').click();

    // Nothing to close before anything has been sent.
    await expect(page.locator('.close-report-btn')).toBeHidden();

    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('The form should close itself out.');
    await page.locator('.submit-btn').click();

    await expect(page.locator('.report-form-status.success')).toBeVisible();
    await expect(page.locator('.submit-btn')).toBeHidden();
    await expect(page.locator('.cancel-btn')).toBeHidden();
    await expect(page.locator('.close-report-btn')).toBeVisible();
    await expect(page.locator('.close-report-btn')).toBeFocused();

    // Close dismisses the dialog rather than dropping the reader back into the
    // modal they were already looking at.
    await page.locator('.close-report-btn').click();
    await expect(page.locator('#flagModalTitle')).toHaveCount(0);

    // Re-opening the flag gives a clean form again.
    await openFirstFlagModal(page);
    await page.locator('.report-issue-btn').click();
    await expect(page.locator('.submit-btn')).toBeVisible();
    await expect(page.locator('.close-report-btn')).toBeHidden();
    await expect(page.locator('#issueDescription')).toHaveValue('');
    await expect(page.locator('.report-form-status')).toBeHidden();
  });

  test('bot verification runs on submit, not when the report form opens', async ({ page }) => {
    // Opening a report form used to mint a token, which meant a challenge for
    // every abandoned form and a widget left sitting in the form afterwards.
    // The challenge now runs as part of submitting. See #146.
    let submittedBody = null;
    await page.route('**/api/report-issue', async (route) => {
      submittedBody = route.request().postDataJSON();
      // Hold the response briefly so the pending state is observable.
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          partial: false,
          destinations: { telegram: true, github: false },
          githubIssueUrl: null
        })
      });
    });

    await openFirstFlagModal(page);
    await page.locator('.report-issue-btn').click();
    await expect(page.locator('#reportFormPanel')).toBeVisible();

    // No widget while the user is still filling the form in.
    expect(await page.evaluate(() => window.__turnstileRenders)).toBe(0);

    await page.locator('#issueType').selectOption('incorrect_info');
    await page.locator('#issueDescription').fill('Verification should run on submit.');
    await page.locator('.submit-btn').click();

    // The form says what it is doing and refuses a second submit meanwhile.
    await expect(page.locator('.report-form-status.pending')).toBeVisible();
    await expect(page.locator('.submit-btn')).toBeDisabled();

    await expect(page.locator('.report-form-status.success')).toBeVisible();
    await expect(page.locator('.submit-btn')).toBeEnabled();

    expect(await page.evaluate(() => window.__turnstileRenders)).toBe(1);
    expect(submittedBody.turnstileToken).toMatch(/^stub-token-/);
    expect(submittedBody['cf-turnstile-response']).toBeUndefined();
  });

  test('the report form and its status messages stay in view on a phone', async ({ browser, baseURL }) => {
    // The modal body scrolls on its own and the report flow sits at the bottom
    // of it, so opening the form and every status message that follows was
    // appended below the fold for a reader already scrolled to the end.
    const context = await createPhoneContext(browser, baseURL);
    const page = await context.newPage();
    try {
      await stubTurnstile(page);
      await page.route('**/api/report-issue', async (route) => {
        // Hold the response so the pending state can be checked on its own.
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            partial: false,
            destinations: { telegram: true, github: false },
            githubIssueUrl: null
          })
        });
      });

      await gotoApp(page, 'en');
      await page.locator('.learn-more-btn').first().tap();
      await expect(page.locator('#flagModalTitle')).toBeVisible();

      // The static info modal is always in the DOM, so pick the flag modal.
      const modalContent = page.locator('.modal-content').filter({ has: page.locator('#flagModalTitle') });
      await modalContent.evaluate((el) => { el.scrollTop = el.scrollHeight; });

      await page.locator('.report-issue-btn').tap();
      await expect(page.locator('#reportFormPanel')).toBeInViewport({ ratio: 0.1 });
      await expect(page.locator('#issueType')).toBeInViewport({ ratio: 0.9 });

      await page.locator('#issueType').selectOption('incorrect_info');
      await page.locator('#issueDescription').fill('Status messages should not land below the fold.');
      await modalContent.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.locator('.submit-btn').tap();

      await expect(page.locator('.report-form-status.pending')).toBeInViewport({ ratio: 0.9 });
      await expect(page.locator('.report-form-status.success')).toBeInViewport({ ratio: 0.9 });
    } finally {
      await context.close();
    }
  });

  test('report form does not ghost-focus the issue type select on touch devices', async ({ browser, baseURL }) => {
    // Regression test: programmatically focusing a <select> on a touch device
    // leaves it "ghost-focused" without opening the native picker, so the
    // first physical tap just clears the focus instead of opening the
    // dropdown. Focus is therefore only moved automatically when the device
    // has a fine pointer (mouse/trackpad) — both when the form opens and
    // after a report has been submitted.
    const context = await createPhoneContext(browser, baseURL);
    const page = await context.newPage();
    try {
      await stubTurnstile(page);
      await page.route('**/api/report-issue', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            partial: false,
            destinations: { telegram: true, github: false },
            githubIssueUrl: null
          })
        });
      });

      await gotoApp(page, 'en');
      await page.locator('.learn-more-btn').first().tap();
      await expect(page.locator('#flagModalTitle')).toBeVisible();

      await page.locator('.report-issue-btn').tap();
      await expect(page.locator('#reportFormPanel')).toBeVisible();

      // The select must not be pre-focused on coarse-pointer devices...
      await expect(page.locator('#issueType')).not.toBeFocused();

      // ...so the first tap on it focuses it and opens the native picker.
      await page.locator('#issueType').tap();
      await expect(page.locator('#issueType')).toBeFocused();

      // Sending replaces the form with its receipt, so the select is gone
      // rather than sitting there ghost-focused.
      await page.locator('#issueType').selectOption('incorrect_info');
      await page.locator('#issueDescription').fill('Reported from a touch device.');
      await page.locator('.submit-btn').tap();

      await expect(page.locator('.report-form-status.success')).toBeVisible();
      await expect(page.locator('#issueType')).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
