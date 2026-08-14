// DOM Elements
const searchInput = document.getElementById('searchInput');
const flagGrid = document.getElementById('flagGrid');
const resetFiltersButton = document.getElementById('resetFiltersButton');
const languageSelect = document.getElementById('languageSelect');

// Global variables
let flags = [];
let filteredFlags = [];
let baseFlagInfo = [];
// Lookup caches, rebuilt whenever the flag list is (re)built. flagsByCode makes
// "Learn more" resolution O(1); flagCardsByCode holds one persistent DOM card per
// flag so filtering reorders nodes instead of recreating them. See #142.
let flagsByCode = new Map();
let flagCardsByCode = new Map();
let uiTranslations = {};
let fallbackUiTranslations = {};
let flagTranslations = {};
let currentLanguage = 'en';
const SUPPORTED_LANGUAGES = ['en', 'es'];
const DEFAULT_LANGUAGE = 'en';
const QUERY_FILTER_DATA_KEYS = ['color', 'continent', 'pattern', 'symbol', 'motive', 'people', 'ideology', 'text'];
const AMAZON_ASSOCIATE_TAG = 'flagfilter-20';

// localStorage can throw on every access (private mode, blocked storage — notably
// Safari). Route all persistence through these helpers so a denied store degrades
// to "no persistence" instead of aborting initApp. See #146.
function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        // Storage unavailable — the app keeps working without persistence.
    }
}

// Cloudflare Turnstile bot protection for the report form. The site key is
// public by design; the matching TURNSTILE_SECRET_KEY lives as a secret on the
// Pages project. Until that secret is set the widget renders but the server
// skips verification, so reports keep going through. See #146.
const TURNSTILE_SITE_KEY = '0x4AAAAAAEO8-UkMVW5o0VjW';
const TURNSTILE_TIMEOUT_MS = 30000;
// Cloudflare can ask the reader to tick a box. That runs at their pace, not the
// network's, so the fallback gets a longer budget once the challenge is theirs.
const TURNSTILE_INTERACTION_TIMEOUT_MS = 120000;
let turnstileScriptPromise = null;

// Programmatic focus on a <select> leaves it "ghost-focused" on touch devices:
// the native picker stays closed and the first physical tap only clears the
// focus. Move focus automatically only on devices with a fine pointer
// (mouse/trackpad). See #146.
function focusIfFinePointer(element) {
    if (element && window.matchMedia('(pointer: fine)').matches) {
        element.focus();
    }
}

// The modal body is its own scroll container and the report flow lives at the
// bottom of it, so anything revealed there — the form itself, and every status
// message — lands below the fold for a reader who has already scrolled down.
// 'nearest' scrolls the least amount needed and does nothing when the element
// is already visible.
function revealInScrollParent(element) {
    element.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
}

function loadTurnstileScript() {
    if (!turnstileScriptPromise) {
        turnstileScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        // Only success is worth caching. Holding on to a rejected promise would
        // turn one network hiccup into a session where every later report fails
        // verification until the page is reloaded.
        turnstileScriptPromise.catch(() => {
            turnstileScriptPromise = null;
        });
    }

    return turnstileScriptPromise;
}

function getLanguageFromUrl() {
    const lang = new URLSearchParams(window.location.search).get('lang');
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
}

function getQueryFromUrl() {
    return new URLSearchParams(window.location.search).get('q') || '';
}

function getInitialLanguage() {
    const queryLanguage = getLanguageFromUrl();
    if (queryLanguage) {
        return queryLanguage;
    }

    const savedLanguage = safeStorageGet('language');
    if (SUPPORTED_LANGUAGES.includes(savedLanguage)) {
        return savedLanguage;
    }

    const browserLanguage = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(browserLanguage)) {
        return browserLanguage;
    }

    return DEFAULT_LANGUAGE;
}

function updateLanguageInUrl(language) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', language);
    window.history.replaceState({}, '', url);
}

function updateQueryInUrl(query) {
    const url = new URL(window.location.href);
    if (hasTextValue(query)) {
        url.searchParams.set('q', query);
    } else {
        url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url);
}

function t(key, vars = {}) {
    const template = hasTextValue(uiTranslations[key])
        ? uiTranslations[key]
        : (hasTextValue(fallbackUiTranslations[key]) ? fallbackUiTranslations[key] : key);
    return template.replace(/\{(\w+)\}/g, (_, varName) => vars[varName] ?? `{${varName}}`);
}

function hasTextValue(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function setButtonLabel(button, label) {
    const icon = button.querySelector('.icon');
    if (!icon) {
        button.textContent = label;
        return;
    }

    button.innerHTML = '';
    button.appendChild(icon);
    icon.setAttribute('aria-hidden', 'true');
    button.append(` ${label}`);
}

function updateToggleButtonState(button) {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
}

function updateAllToggleButtonStates() {
    document.querySelectorAll('.filter-btn').forEach(updateToggleButtonState);
}

function normalizeQueryValue(value) {
    return String(value || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function getFilterButtonsWithQueryMetadata() {
    return Array.from(document.querySelectorAll('.filter-btn')).map((button) => {
        const dataKey = QUERY_FILTER_DATA_KEYS.find((key) => button.dataset[key]);
        if (!dataKey) {
            return null;
        }

        const value = button.dataset[dataKey];
        const normalizedValue = normalizeQueryValue(value);
        const aliases = new Set([
            normalizedValue,
            normalizedValue.replace(/\s+/g, '')
        ]);

        return {
            button,
            dataKey,
            value,
            aliases
        };
    }).filter(Boolean);
}

function getActiveFilterQueryValues() {
    const activeValues = [];

    QUERY_FILTER_DATA_KEYS.forEach((key) => {
        document.querySelectorAll(`.filter-btn[data-${key}].active`).forEach((button) => {
            activeValues.push(button.dataset[key]);
        });
    });

    return activeValues;
}

function getBaseFlagInfoByCode(code) {
    return baseFlagInfo.find((info) => info.shortname === code);
}

function matchesSearchTerm(flag, normalizedTerm) {
    // The term is normalized once per search by the caller (handleSearch /
    // applyFilters), not once per flag comparison. An empty normalized term
    // here means the input only contained characters the normalization strips
    // (e.g. punctuation) and matches nothing; a truly empty search is handled
    // by the callers and shows all flags.
    return normalizedTerm !== '' && flag.searchText.includes(normalizedTerm);
}

function syncQueryParamFromUiState() {
    const searchTokens = searchInput.value
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const queryTokens = [
        ...getActiveFilterQueryValues(),
        ...searchTokens
    ];

    updateQueryInUrl(queryTokens.join(' '));
}

function applyInitialQueryFromUrl() {
    const rawQuery = getQueryFromUrl();

    if (hasTextValue(rawQuery)) {
        const rawWords = rawQuery.trim().split(/\s+/).filter(Boolean);
        const filterButtons = getFilterButtonsWithQueryMetadata();
        const matchedButtons = new Set();
        const remainingSearchTerms = [];

        for (let index = 0; index < rawWords.length;) {
            let matchedEntry = null;

            for (let end = rawWords.length; end > index; end -= 1) {
                const phrase = normalizeQueryValue(rawWords.slice(index, end).join(' '));
                const entry = filterButtons.find((candidate) => (
                    !matchedButtons.has(candidate.button) && candidate.aliases.has(phrase)
                ));

                if (entry) {
                    matchedEntry = { entry, end };
                    break;
                }
            }

            if (matchedEntry) {
                matchedButtons.add(matchedEntry.entry.button);
                index = matchedEntry.end;
                continue;
            }

            remainingSearchTerms.push(rawWords[index]);
            index += 1;
        }

        matchedButtons.forEach((button) => {
            button.classList.add('active');
            updateToggleButtonState(button);
        });

        searchInput.value = remainingSearchTerms.join(' ');
    }

    // Render once, after the initial filter/search state is resolved, so the first
    // paint (and the eager / high-priority LCP image) reflects the real above-the-fold
    // flag instead of the unfiltered list. See PR #115.
    applyFilters();
}

async function loadJson(path, fallbackValue = {}) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            return fallbackValue;
        }
        return await response.json();
    } catch (error) {
        console.warn(`Could not load ${path}:`, error);
        return fallbackValue;
    }
}

async function loadTranslations(language) {
    fallbackUiTranslations = await loadJson('i18n/ui/en.json', {});
    uiTranslations = language === 'en'
        ? fallbackUiTranslations
        : await loadJson(`i18n/ui/${language}.json`, fallbackUiTranslations);

    flagTranslations = language === 'en'
        ? {}
        : await loadJson(`i18n/flags/${language}.json`, {});
}

// Dark mode functionality. The dark-mode class lives on <html> so the inline
// snippet in <head> can set it before first paint (see index.html); this
// function owns it from here on. The toggle icons follow the class via CSS
// (.dark-mode .dark-mode-toggle …), so toggling the class is the whole state
// change. See #143.
function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function setDarkMode(enabled) {
        document.documentElement.classList.toggle('dark-mode', enabled);
    }

    // A saved choice wins; without one, start from the system theme.
    const savedDarkMode = safeStorageGet('darkMode');
    setDarkMode(savedDarkMode !== null ? savedDarkMode === 'true' : systemDark.matches);

    // Follow system theme changes live — but only until the user picks a side.
    // The system-derived choice is deliberately not saved: persisting it would
    // freeze whatever the system happened to be on first visit.
    const onSystemThemeChange = (event) => {
        if (safeStorageGet('darkMode') === null) {
            setDarkMode(event.matches);
        }
    };
    // MediaQueryList only gained addEventListener in Safari 14; older versions
    // expose just addListener. Guard both so a missing method cannot throw here
    // and take down the rest of initApp.
    if (typeof systemDark.addEventListener === 'function') {
        systemDark.addEventListener('change', onSystemThemeChange);
    } else if (typeof systemDark.addListener === 'function') {
        systemDark.addListener(onSystemThemeChange);
    }

    darkModeToggle.addEventListener('click', () => {
        const enabled = !document.documentElement.classList.contains('dark-mode');
        setDarkMode(enabled);
        safeStorageSet('darkMode', String(enabled));
    });
}

function localizeFlagInfo(info) {
    if (currentLanguage === 'en') {
        return { ...info };
    }

    const translatedInfo = { ...info };
    const translatableFields = ['name', 'symbolism', 'funfacts', 'adopted', 'proportion'];

    translatableFields.forEach((field) => {
        const key = `${info.shortname}_${field}`;
        if (hasTextValue(flagTranslations[key])) {
            translatedInfo[field] = flagTranslations[key];
        }
    });

    return translatedInfo;
}

function rebuildFlags() {
    flags = baseFlagInfo.map((baseInfo) => {
        const info = localizeFlagInfo(baseInfo);
        const code = info.shortname;
        const url = `https://flagcdn.com/w320/${code}.webp`;
        const tags = info.tags || '';
        const colorTags = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'brown', 'purple', 'orange'];
        const colors = colorTags.filter(color => tags.includes(color));

        // Precompute one normalized search haystack per flag (localized name +
        // English base name + code + tags), so matchesSearchTerm becomes a single
        // includes() that folds diacritics and works regardless of UI language.
        // Each field is normalized separately and joined with a NUL sentinel that
        // the query normalization always strips, so a search term can never match
        // across a field boundary (e.g. "spain es"). See #144 and #151.
        const searchText = [info.name || '', baseInfo.name || '', code, tags]
            .map(normalizeQueryValue)
            .join(String.fromCharCode(0));

        return {
            code,
            url,
            continent: info.continent || null,
            name: info.name || code.toUpperCase(),
            colors,
            tags: tags.split(' '),
            info,
            searchText
        };
    });
    flagsByCode = new Map(flags.map((flag) => [flag.code, flag]));
    buildFlagCards();
}

// Fetch flag data from local source and apply translations
async function fetchFlags() {
    try {
        const flagInfoResponse = await fetch('flaginfo.json');
        baseFlagInfo = await flagInfoResponse.json();
        rebuildFlags();

        // Don't render here: initApp resolves the initial ?q= filter first, so the
        // grid renders exactly once with the correct above-the-fold flags (and the
        // eager / high-priority LCP image lands on the right one). See PR #115.
        return flags;
    } catch (error) {
        console.error('Error fetching flag data:', error);
        flagGrid.innerHTML = `<p class="error">${t('error_loading_flags')}</p>`;
    }
}

function applyStaticTranslations() {
    document.documentElement.lang = currentLanguage;
    document.title = t('page_title');
    searchInput.placeholder = t('search_placeholder');
    searchInput.setAttribute('aria-label', t('search_input_aria'));
    resetFiltersButton.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-rotate-left"></use></svg> ${t('reset_button')}`;
    resetFiltersButton.setAttribute('aria-label', t('reset_button_aria'));

    const titleReset = document.getElementById('titleReset');
    if (titleReset) {
        titleReset.setAttribute('aria-label', t('title_reset_aria'));
        titleReset.title = t('reset_button_aria');
    }

    const infoButton = document.getElementById('infoButton');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const infoModal = document.getElementById('infoModal');
    infoButton.setAttribute('aria-label', t('info_button_aria'));
    darkModeToggle.setAttribute('aria-label', t('dark_mode_aria'));

    const filterHeaders = document.querySelectorAll('.filter-section .filter-header .filter-title');
    if (filterHeaders[0]) filterHeaders[0].textContent = t('filter_by_color');
    if (filterHeaders[1]) filterHeaders[1].textContent = t('more_filters');

    const groupHeadings = document.querySelectorAll('.compact-filter-group h3');
    const groupHeadingKeys = ['continent', 'pattern', 'symbol', 'motive', 'people_or_clothing', 'ideology', 'text'];
    groupHeadings.forEach((heading, index) => {
        heading.textContent = t(groupHeadingKeys[index]);
    });

    document.querySelectorAll('.filter-btn[data-color]').forEach(button => {
        button.textContent = t(`color_${button.dataset.color}`);
    });

    document.querySelectorAll('.filter-btn[data-continent]').forEach(button => {
        setButtonLabel(button, t(`continent_${button.dataset.continent}`));
    });

    document.querySelectorAll('.filter-btn[data-pattern]').forEach(button => {
        setButtonLabel(button, t(`pattern_${button.dataset.pattern}`));
    });

    document.querySelectorAll('.filter-btn[data-symbol]').forEach(button => {
        setButtonLabel(button, t(`symbol_${button.dataset.symbol}`));
    });

    document.querySelectorAll('.filter-btn[data-motive]').forEach(button => {
        setButtonLabel(button, t(`motive_${button.dataset.motive}`));
    });

    document.querySelectorAll('.filter-btn[data-people]').forEach(button => {
        setButtonLabel(button, t(`people_${button.dataset.people}`));
    });

    document.querySelectorAll('.filter-btn[data-ideology]').forEach(button => {
        setButtonLabel(button, t(`ideology_${button.dataset.ideology}`));
    });

    document.querySelectorAll('.filter-btn[data-text]').forEach(button => {
        setButtonLabel(button, t(`text_${button.dataset.text}`));
    });

    const closeBtn = infoModal.querySelector('.close-btn');
    const infoTitle = infoModal.querySelector('h2');
    const infoContent = infoModal.querySelector('.info-content');
    const translationDisclaimer = currentLanguage === 'es'
        ? `<p><strong>${t('translation_disclaimer_label')}:</strong> ${t('translation_disclaimer_es')}</p>`
        : '';
    closeBtn.setAttribute('aria-label', t('close'));
    infoTitle.textContent = t('about_flagfilter');
    infoContent.innerHTML = `
        <p><strong>${t('contact_label')}:</strong> <a href="mailto:info@flagfilter.com">info@flagfilter.com</a></p>
        <p><strong>${t('source_code_label')}:</strong> <a href="https://github.com/matalve/flagfilter" target="_blank" rel="noopener noreferrer">GitHub</a></p>
        <p><strong>${t('flags_provided_by_label')}:</strong> <a href="https://flagpedia.net/" target="_blank" rel="noopener noreferrer">Flagpedia</a></p>
        <p><strong>${t('help_translate_label')}:</strong> <a href="https://poeditor.com/join/project/P7N0JxV3wI" target="_blank" rel="noopener noreferrer">${t('help_translate_link_text')}</a></p>
        ${translationDisclaimer}
    `;

    updateAllToggleButtonStates();
}

async function switchLanguage(language) {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
        return;
    }

    currentLanguage = language;
    safeStorageSet('language', language);
    updateLanguageInUrl(language);
    await loadTranslations(language);
    applyStaticTranslations();

    if (baseFlagInfo.length > 0) {
        rebuildFlags();
        applyFilters();
    }

    if (languageSelect) {
        languageSelect.value = language;
    }
}

// flagcdn serves every w320 image at 320px wide; the height follows the flag's proportion.
const FLAG_IMAGE_SOURCE_WIDTH = 320;
// The grid crops every flag to a uniform 3:2 box (see `.flag-card img` in styles.css),
// so reserve that ratio up front to avoid layout shift while images load.
const FLAG_GRID_IMAGE_HEIGHT = Math.round(FLAG_IMAGE_SOURCE_WIDTH * 2 / 3);
// Eagerly load the first row(s) of above-the-fold flag images instead of lazily,
// so the LCP image (the first one) is not deferred behind the data fetch. See #108.
const EAGER_FLAG_IMAGE_COUNT = 8;

// Derive intrinsic pixel dimensions from a "height:width" proportion (e.g. "5:8").
// Returns null for non-numeric proportions such as Nepal's "It's complicated.".
function getFlagImageDimensions(proportion) {
    const match = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(String(proportion || ''));
    if (!match) {
        return null;
    }

    const heightUnits = Number(match[1]);
    const widthUnits = Number(match[2]);
    if (!heightUnits || !widthUnits) {
        return null;
    }

    return {
        width: FLAG_IMAGE_SOURCE_WIDTH,
        height: Math.round(FLAG_IMAGE_SOURCE_WIDTH * heightUnits / widthUnits)
    };
}

// Create one persistent card element per flag. Cards are built once per language
// (names, alt texts and button labels are localized) and then reused across renders.
function createFlagCard(flag) {
    const flagCard = document.createElement('div');
    flagCard.className = 'flag-card';

    flagCard.innerHTML = `
        <img src="${flag.url}" alt="${t('flag_image_alt', { name: flag.name })}" width="${FLAG_IMAGE_SOURCE_WIDTH}" height="${FLAG_GRID_IMAGE_HEIGHT}" loading="lazy">
        <h3>${flag.name}</h3>
        <button class="learn-more-btn" data-code="${flag.code}" aria-haspopup="dialog">${t('learn_more')}</button>
    `;

    return flagCard;
}

function buildFlagCards() {
    flagCardsByCode = new Map(flags.map((flag) => [flag.code, createFlagCard(flag)]));
}

// Render the flag grid by reordering the persistent card nodes (appendChild moves
// an existing node instead of recreating it), so filtering no longer rebuilds
// ~250 cards per interaction. See #142.
function renderFlagGrid() {
    if (filteredFlags.length === 0) {
        flagGrid.replaceChildren();
        const noResults = document.createElement('p');
        noResults.className = 'no-results';
        noResults.textContent = t('no_results');
        flagGrid.appendChild(noResults);
        updateFlagCounter(0);
        return;
    }

    const visibleCards = new Set();
    filteredFlags.forEach((flag, index) => {
        const flagCard = flagCardsByCode.get(flag.code);

        // Above-the-fold images load eagerly; the first one is the LCP candidate
        // and gets high fetch priority. Everything below the fold stays lazy.
        // These depend on the card's position, so refresh them on every render.
        const image = flagCard.querySelector('img');
        image.loading = index < EAGER_FLAG_IMAGE_COUNT ? 'eager' : 'lazy';
        if (index === 0) {
            image.setAttribute('fetchpriority', 'high');
        } else {
            image.removeAttribute('fetchpriority');
        }

        visibleCards.add(flagCard);
        flagGrid.appendChild(flagCard);
    });

    // Detach the cards that fell out of the result set.
    Array.from(flagGrid.children).forEach((child) => {
        if (!visibleCards.has(child)) {
            child.remove();
        }
    });

    updateFlagCounter(filteredFlags.length);
}

// One delegated listener for every "Learn more" button, registered once on the
// grid instead of one listener per button on every render.
flagGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.learn-more-btn');
    if (!button) {
        return;
    }
    const flag = flagsByCode.get(button.dataset.code);
    if (flag) {
        showFlagInfoModal(flag);
    }
});

function updateFlagCounter(count) {
    const counter = document.getElementById('flagCounter');
    counter.textContent = count === 1
        ? t('flag_counter_one', { count })
        : t('flag_counter_other', { count });
}

function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
}

function handleModalKeydown(event, modal) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeAnyModal(modal);
        return;
    }

    if (event.key !== 'Tab') {
        return;
    }

    const focusableElements = getFocusableElements(modal);
    if (focusableElements.length === 0) {
        event.preventDefault();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

function closeAnyModal(modal) {
    if (typeof modal._closeHandler === 'function') {
        modal._closeHandler();
        return;
    }

    closeModal(modal);
}

function openModal(modal, initialFocusSelector = '.close-btn') {
    modal._previousFocusElement = document.activeElement;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    const keydownHandler = (event) => handleModalKeydown(event, modal);
    modal._keydownHandler = keydownHandler;
    modal.addEventListener('keydown', keydownHandler);

    const initialFocus = modal.querySelector(initialFocusSelector) || getFocusableElements(modal)[0];
    if (initialFocus) {
        initialFocus.focus();
    }
}

function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    if (modal._keydownHandler) {
        modal.removeEventListener('keydown', modal._keydownHandler);
        delete modal._keydownHandler;
    }

    if (modal._previousFocusElement && typeof modal._previousFocusElement.focus === 'function') {
        modal._previousFocusElement.focus();
    }
}

// Show flag information modal
function showFlagInfoModal(flag) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    // Set again further down, once the report form exists, so closing the modal
    // also tears down any Turnstile widget it rendered.
    modal._closeHandler = () => closeDynamicModal(modal);

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', t('close'));
    closeBtn.addEventListener('click', () => {
        closeAnyModal(modal);
    });

    // Create flag image
    const flagImage = document.createElement('img');
    // Use a higher-resolution source for the modal — it's displayed up to 400px wide
    // (more on HiDPI screens), so w320 looked soft. The grid keeps w320 for performance;
    // this w640 fetch only happens when a flag is opened (lazy, not the LCP image).
    flagImage.src = flag.url.replace('/w320/', '/w640/');
    flagImage.alt = t('flag_image_alt', { name: flag.name });
    flagImage.className = 'modal-flag-image';

    // Reserve the flag's intrinsic dimensions so the modal does not shift while it loads.
    const flagImageDimensions = getFlagImageDimensions(flag.info.proportion);
    if (flagImageDimensions) {
        flagImage.width = flagImageDimensions.width;
        flagImage.height = flagImageDimensions.height;
    }

    // Create flag information
    const flagInfo = document.createElement('div');
    flagInfo.className = 'flag-info-details';
    flagInfo.id = 'flagModalDescription';

    // Process HTML content to make links clickable
    const processedSymbolism = processHtmlContent(flag.info.symbolism || t('no_information_available'));
    const processedFunfacts = processHtmlContent(flag.info.funfacts || t('no_fun_facts_available'));

    // Amazon affiliate search link — uses the English base name (so the query works
    // in any UI language) with parenthetical aliases stripped. See #126.
    const baseInfo = getBaseFlagInfoByCode(flag.code);
    const englishName = (baseInfo?.name || flag.name).replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const shopUrl = `https://www.amazon.com/s?k=${encodeURIComponent(englishName + ' flag')}&tag=${AMAZON_ASSOCIATE_TAG}`;

    // Add flag information
    flagInfo.innerHTML = `
        <h2 id="flagModalTitle">${flag.name}</h2>
        <p><strong>${t('adopted_label')}:</strong> ${flag.info.adopted || t('unknown')}</p>
        <p><strong>${t('symbolism_label')}:</strong> ${processedSymbolism}</p>
        <p><strong>${t('fun_facts_label')}:</strong> ${processedFunfacts}</p>
        <p><strong>${t('colors_label')}:</strong> ${flag.colors.map((color) => t(`color_${color}`)).join(', ')}</p>
        <div class="modal-actions">
            <a href="${flag.info.wikipedialink}" target="_blank" rel="noopener noreferrer" class="wiki-link">${t('read_more_wikipedia')}</a>
            <a href="${shopUrl}" target="_blank" rel="noopener noreferrer sponsored nofollow" class="shop-link">${t('shop_flag', { name: flag.name })}</a>
            <button class="report-issue-btn" aria-expanded="false" aria-controls="reportFormPanel">${t('report_issue')}</button>
        </div>
        <p class="affiliate-disclosure">${t('amazon_disclosure')}</p>
    `;

    // Create report issue form (initially hidden)
    const reportForm = document.createElement('div');
    reportForm.className = 'report-form';
    reportForm.id = 'reportFormPanel';
    reportForm.style.display = 'none';
    reportForm.innerHTML = `
        <h3>${t('report_issue')}</h3>
        <form id="reportForm">
            <input type="hidden" name="flagCode" value="${flag.code}">

            <div class="form-group">
                <label for="issueType">${t('type_of_issue_label')}:</label>
                <select name="issueType" id="issueType" required>
                    <option value="">${t('select_issue_type')}</option>
                    <option value="incorrect_info">${t('issue_incorrect_info')}</option>
                    <option value="missing_info">${t('issue_missing_info')}</option>
                    <option value="broken_link">${t('issue_broken_link')}</option>
                    <option value="other">${t('issue_other')}</option>
                </select>
            </div>

            <div class="form-group">
                <label for="issueDescription">${t('description_label')}:</label>
                <textarea name="issueDescription" id="issueDescription" required
                    maxlength="2000"
                    placeholder="${t('issue_description_placeholder')}"></textarea>
            </div>

            <div class="form-group">
                <label for="userEmail">${t('your_email_optional_label')}:</label>
                <input type="email" name="userEmail" id="userEmail"
                    maxlength="254"
                    placeholder="${t('email_placeholder')}">
            </div>

            ${TURNSTILE_SITE_KEY ? '<div class="turnstile-widget"></div>' : ''}

            <div class="form-actions">
                <button type="submit" class="submit-btn">${t('submit_report')}</button>
                <button type="button" class="cancel-btn">${t('cancel')}</button>
            </div>

        </form>

        <!-- Outside the form: the receipt has to survive the form being hidden
             once a report has been sent. -->
        <div class="report-form-status" role="status" aria-live="polite" hidden></div>

        <div class="form-actions report-form-done" hidden>
            <button type="button" class="close-report-btn">${t('close')}</button>
        </div>
    `;

    // Assemble modal
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(flagImage);
    modalContent.appendChild(flagInfo);
    modalContent.appendChild(reportForm);
    modal.appendChild(modalContent);
    modal.setAttribute('aria-labelledby', 'flagModalTitle');
    modal.setAttribute('aria-describedby', 'flagModalDescription');

    // Add modal to body
    document.body.appendChild(modal);
    openModal(modal);

    // Handle report issue button click
    const reportBtn = flagInfo.querySelector('.report-issue-btn');
    const form = reportForm.querySelector('#reportForm');
    const cancelBtn = reportForm.querySelector('.cancel-btn');
    const doneActions = reportForm.querySelector('.report-form-done');
    const closeReportBtn = reportForm.querySelector('.close-report-btn');
    const statusMessage = reportForm.querySelector('.report-form-status');
    const submitBtn = reportForm.querySelector('.submit-btn');
    let turnstileWidgetId = null;
    let pendingVerification = null;
    let verificationTimeoutId = null;

    // The challenge runs when the report is submitted, not when the form opens.
    // Running it up front minted a token for every form that was opened and
    // abandoned, and left the widget sitting in the form looking like an
    // unfinished step once a report had been sent. See #146.
    function clearVerificationTimeout() {
        if (verificationTimeoutId !== null) {
            window.clearTimeout(verificationTimeoutId);
            verificationTimeoutId = null;
        }
    }

    // Only ever one timer in flight: restarting replaces the previous one.
    function startVerificationTimeout(delayMs) {
        clearVerificationTimeout();
        verificationTimeoutId = window.setTimeout(() => settleVerification(null, 'turnstile-timeout'), delayMs);
    }

    function settleVerification(token, errorCode) {
        // Drop this attempt's timeout with it. Left running, it would still fire
        // later and settle whatever attempt happened to be pending by then —
        // rejecting a retry that was doing nothing wrong.
        clearVerificationTimeout();

        const pending = pendingVerification;
        pendingVerification = null;

        if (!pending) {
            return;
        }

        if (token) {
            pending.resolve(token);
        } else {
            pending.reject(new Error(errorCode));
        }
    }

    async function renderTurnstileWidget() {
        await loadTurnstileScript();

        if (turnstileWidgetId === null) {
            turnstileWidgetId = window.turnstile.render(reportForm.querySelector('.turnstile-widget'), {
                sitekey: TURNSTILE_SITE_KEY,
                // Wait for turnstile.execute() instead of challenging on render.
                execution: 'execute',
                // Stay out of the layout unless Cloudflare needs the user to act.
                appearance: 'interaction-only',
                callback: (token) => settleVerification(token),
                'before-interactive-callback': () => {
                    showReportStatus('pending', t('report_verify_interaction'));
                    // The wait is now the reader ticking a box, so the short
                    // network-shaped budget would cut them off mid-interaction.
                    startVerificationTimeout(TURNSTILE_INTERACTION_TIMEOUT_MS);
                },
                'error-callback': () => {
                    settleVerification(null, 'turnstile-error');
                    return true;
                },
                'timeout-callback': () => settleVerification(null, 'turnstile-timeout'),
                'expired-callback': () => settleVerification(null, 'turnstile-expired')
            });
        }

        return turnstileWidgetId;
    }

    // Resolves with a fresh token, or '' when Turnstile is not configured. Tokens
    // are single-use, so the widget is reset before every run.
    async function requestTurnstileToken() {
        if (!TURNSTILE_SITE_KEY) {
            return '';
        }

        const widgetId = await renderTurnstileWidget();
        window.turnstile.reset(widgetId);

        return new Promise((resolve, reject) => {
            pendingVerification = { resolve, reject };
            // Belt and braces: Turnstile has its own timeout-callback, but a
            // challenge that never settles would otherwise leave the form
            // disabled with no way out.
            startVerificationTimeout(TURNSTILE_TIMEOUT_MS);
            window.turnstile.execute(widgetId);
        });
    }

    function removeTurnstileWidget() {
        if (turnstileWidgetId !== null && window.turnstile) {
            window.turnstile.remove(turnstileWidgetId);
            turnstileWidgetId = null;
        }
    }

    function clearReportStatus() {
        statusMessage.hidden = true;
        statusMessage.className = 'report-form-status';
        statusMessage.textContent = '';
        statusMessage.replaceChildren();
    }

    function showReportStatus(type, message, githubIssueUrl = '', followUpMessage = '') {
        statusMessage.hidden = false;
        statusMessage.className = `report-form-status ${type}`;
        statusMessage.textContent = '';

        const messageText = document.createElement('div');
        messageText.className = 'report-status-primary';
        messageText.textContent = message;
        statusMessage.appendChild(messageText);

        if (githubIssueUrl && followUpMessage) {
            const followUpLine = document.createElement('div');
            followUpLine.className = 'report-status-secondary';
            followUpLine.textContent = `${followUpMessage} `;

            const issueLink = document.createElement('a');
            issueLink.href = githubIssueUrl;
            issueLink.target = '_blank';
            issueLink.rel = 'noopener noreferrer';
            issueLink.textContent = t('view_github_issue');
            followUpLine.appendChild(issueLink);
            statusMessage.appendChild(followUpLine);
        }

        revealInScrollParent(statusMessage);
    }

    reportBtn.addEventListener('click', () => {
        clearReportStatus();
        reportForm.style.display = 'block';
        reportBtn.style.display = 'none';
        reportBtn.setAttribute('aria-expanded', 'true');
        focusIfFinePointer(form.querySelector('#issueType'));
        // A fine pointer gets this for free from focus(); a touch device does
        // not, and the form opens exactly where the trigger button used to be —
        // at the very bottom of the modal.
        revealInScrollParent(reportForm);
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        // Turnstile injects its own hidden cf-turnstile-response input; the token
        // this request uses is the one minted below, so drop the form copy.
        delete data['cf-turnstile-response'];

        // Verification and sending both take a moment, so the form says what it
        // is doing and stops accepting a second submit while it works.
        submitBtn.disabled = true;
        showReportStatus('pending', t('report_verifying'));

        try {
            try {
                data.turnstileToken = await requestTurnstileToken();
            } catch (error) {
                console.error('Turnstile verification failed:', error);
                showReportStatus('error', t('report_verification_failed'));
                return;
            }

            showReportStatus('pending', t('report_sending'));

            const response = await fetch('/api/report-issue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                // The report is sent, so Submit and Cancel no longer describe
                // anything the reader can do: swap the whole form for its
                // receipt and a single way out. Hide before showing the status,
                // so it is scrolled into view against the final layout.
                form.reset();
                form.hidden = true;
                doneActions.hidden = false;

                if (result.githubIssueUrl) {
                    showReportStatus('success', t('report_success'), result.githubIssueUrl, t('report_success_with_issue_link'));
                } else {
                    showReportStatus('success', t('report_success'));
                }

                closeReportBtn.focus();
            } else {
                throw new Error(result.error || t('failed_to_submit_report'));
            }
        } catch (error) {
            showReportStatus('error', t('report_error'));
            console.error('Error submitting report:', error);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Cancel means "never mind, I am staying here", so it collapses the panel
    // back to the trigger button with the form ready for a fresh report.
    function collapseReportForm() {
        clearReportStatus();
        form.reset();
        form.hidden = false;
        doneActions.hidden = true;
        reportForm.style.display = 'none';
        reportBtn.style.display = 'inline-flex';
        reportBtn.setAttribute('aria-expanded', 'false');
        reportBtn.focus();
    }

    cancelBtn.addEventListener('click', collapseReportForm);

    // Close means the reader is done: dismiss the whole dialog. Collapsing back
    // to the trigger button looked like nothing had happened, since the modal
    // was already scrolled to the end.
    closeReportBtn.addEventListener('click', () => closeAnyModal(modal));

    // A modal is built per open and dropped on close, so unregister the widget
    // with Turnstile as well instead of only detaching its DOM node.
    modal._closeHandler = () => {
        removeTurnstileWidget();
        closeDynamicModal(modal);
    };

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAnyModal(modal);
        }
    });

    // Add event listeners to flag links in the modal
    setTimeout(() => {
        document.querySelectorAll('.flag-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const flagCode = link.getAttribute('data-flag-code');
                const linkedFlag = flags.find(f => f.code === flagCode);
                if (linkedFlag) {
                    closeDynamicModal(modal);
                    showFlagInfoModal(linkedFlag);
                }
            });
        });
    }, 0);
}

function closeDynamicModal(modal) {
    closeModal(modal);
    modal.remove();
}

// Process HTML content to make links clickable
function processHtmlContent(htmlContent) {
    if (!htmlContent) return '';

    const normalizeForQuery = (value) => value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/&/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '+');

    // Parse with DOMParser instead of rewriting the HTML with regex, so links
    // keep working even if flaginfo.json content gains attributes or nested
    // markup. ?q= links are resolved against baseFlagInfo (English source names)
    // so translated UI names do not break them. See #146.
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');

    doc.querySelectorAll('a[href^="?q="]').forEach((link) => {
        const queryValue = link.getAttribute('href').slice('?q='.length);
        const normalizedQuery = normalizeForQuery(queryValue);

        const matchedBaseFlag = baseFlagInfo.find((info) =>
            normalizeForQuery(info.name) === normalizedQuery
        );

        if (matchedBaseFlag) {
            link.setAttribute('href', '#');
            link.classList.add('flag-link');
            link.setAttribute('data-flag-code', matchedBaseFlag.shortname);
            return;
        }

        const matchedByCode = flags.find((flag) => flag.code.toLowerCase() === queryValue.toLowerCase());
        if (matchedByCode) {
            link.setAttribute('href', '#');
            link.classList.add('flag-link');
            link.setAttribute('data-flag-code', matchedByCode.code);
            return;
        }

        // Unresolvable link: keep the link text, drop the anchor (same as before).
        link.replaceWith(...link.childNodes);
    });

    return doc.body.innerHTML;
}

// Search is debounced so typing does not trigger a filter pass plus grid render
// per keystroke; it settles ~150 ms after the last input. See #142.
const SEARCH_DEBOUNCE_MS = 150;
let searchDebounceTimer = null;

function debounceSearch(query) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        searchDebounceTimer = null;
        handleSearch(query);
    }, SEARCH_DEBOUNCE_MS);
}

// Search functionality
function handleSearch(query) {
    // Normalize once per search instead of once per flag (see matchesSearchTerm).
    const normalizedTerm = normalizeQueryValue(query);

    if (query.trim() === '') {
        applyFilters();
        return;
    }

    filteredFlags = flags.filter((flag) => matchesSearchTerm(flag, normalizedTerm));
    applyFilters();
}

// Apply all active filters
function applyFilters() {
    const activeColors = Array.from(document.querySelectorAll('.filter-btn[data-color].active'))
        .map(btn => btn.dataset.color);

    const activeContinents = Array.from(document.querySelectorAll('.filter-btn[data-continent].active'))
        .map(btn => btn.dataset.continent);

    const activePatterns = Array.from(document.querySelectorAll('.filter-btn[data-pattern].active'))
        .map(btn => btn.dataset.pattern);

    const activeSymbols = Array.from(document.querySelectorAll('.filter-btn[data-symbol].active'))
        .map(btn => btn.dataset.symbol);

    const activeMotives = Array.from(document.querySelectorAll('.filter-btn[data-motive].active'))
        .map(btn => btn.dataset.motive);

    const activePeople = Array.from(document.querySelectorAll('.filter-btn[data-people].active'))
        .map(btn => btn.dataset.people);

    const activeIdeologies = Array.from(document.querySelectorAll('.filter-btn[data-ideology].active'))
        .map(btn => btn.dataset.ideology);

    const activeTexts = Array.from(document.querySelectorAll('.filter-btn[data-text].active'))
        .map(btn => btn.dataset.text);

    const searchTerm = searchInput.value.toLowerCase().trim();

    // Normalize once per filter pass instead of once per flag (see matchesSearchTerm).
    const normalizedTerm = normalizeQueryValue(searchInput.value);

    // Start with all flags or search results
    let results = searchTerm === ''
        ? [...flags]
        : flags.filter((flag) => matchesSearchTerm(flag, normalizedTerm));

    // Apply color filters
    if (activeColors.length > 0) {
        results = results.filter(flag =>
            activeColors.every(color => flag.colors.includes(color))
        );
    }

    // Apply continent filters
    if (activeContinents.length > 0) {
        results = results.filter(flag => activeContinents.some(continent => flag.continent === continent));
    }

    // Apply pattern filters
    if (activePatterns.length > 0) {
        results = results.filter(flag =>
            activePatterns.some(pattern => flag.tags.includes(pattern))
        );
    }

    // Apply symbol filters
    if (activeSymbols.length > 0) {
        results = results.filter(flag =>
            activeSymbols.some(symbol => flag.tags.includes(symbol))
        );
    }

    // Apply motive filters
    if (activeMotives.length > 0) {
        results = results.filter(flag =>
            activeMotives.some(motive => flag.tags.includes(motive))
        );
    }

    // Apply people/clothing filters
    if (activePeople.length > 0) {
        results = results.filter(flag =>
            activePeople.some(people => flag.tags.includes(people))
        );
    }

    // Apply ideology filters
    if (activeIdeologies.length > 0) {
        results = results.filter(flag =>
            activeIdeologies.some(ideology => flag.tags.includes(ideology))
        );
    }

    // Apply text filters
    if (activeTexts.length > 0) {
        results = results.filter(flag =>
            activeTexts.some(text => flag.tags.includes(text))
        );
    }

    filteredFlags = results;
    renderFlagGrid();
    updateFilterButtonStates(results);
    syncQueryParamFromUiState();
}

function updateFilterButtonStates(currentResults) {
    // Reset all buttons to enabled state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
    });

    // Index the values present in the current results once (O(flags)) so each
    // filter-button test below is an O(1) lookup instead of an O(flags) scan.
    const availableColors = new Set();
    const availableContinents = new Set();
    const availableTags = new Set();
    currentResults.forEach(flag => {
        flag.colors.forEach(color => availableColors.add(color));
        if (flag.continent) {
            availableContinents.add(flag.continent);
        }
        flag.tags.forEach(tag => availableTags.add(tag));
    });

    // Check each filter type
    const filterTypes = ['color', 'continent', 'pattern', 'symbol', 'motive', 'people', 'ideology', 'text'];

    filterTypes.forEach(type => {
        const buttons = document.querySelectorAll(`.filter-btn[data-${type}]`);
        buttons.forEach(button => {
            const value = button.dataset[type];

            // Test if adding this filter would still show results
            let wouldHaveResults;
            if (type === 'color') {
                wouldHaveResults = availableColors.has(value);
            } else if (type === 'continent') {
                wouldHaveResults = availableContinents.has(value);
            } else {
                wouldHaveResults = availableTags.has(value);
            }

            // Disable button if it would result in 0 flags
            if (!wouldHaveResults) {
                button.disabled = true;
                button.classList.add('disabled');
            }
        });
    });
}

// Color filter functionality
function handleColorFilter(color) {
    if (color) {
        const button = document.querySelector(`[data-color="${color}"]`);
        button.classList.toggle('active');
        updateToggleButtonState(button);
    }

    applyFilters();
}

// Continent filter functionality
function handleContinentFilter(continent) {
    const button = document.querySelector(`[data-continent="${continent}"]`);
    button.classList.toggle('active');
    updateToggleButtonState(button);
    applyFilters();
}

function syncFilterSectionState(section) {
    const header = section.querySelector('.filter-header');
    const content = section.querySelector('.filter-content');
    const isCollapsed = section.classList.contains('collapsed');

    if (header) {
        header.setAttribute('aria-expanded', String(!isCollapsed));
    }

    if (content) {
        content.hidden = isCollapsed;
    }
}

// Toggle filter section
function toggleFilterSection(header) {
    const section = header.closest('.filter-section');
    section.classList.toggle('collapsed');

    // Save the state to localStorage using a stable key that does not change with translations
    const sectionId = section.dataset.sectionId;
    const isCollapsed = section.classList.contains('collapsed');
    syncFilterSectionState(section);
    safeStorageSet(`filterSection_${sectionId}`, isCollapsed);
}

// Collapse the filter panels back to their default layout (the advanced "More filters"
// section closed, the rest open). Used by the title reset so the page returns to a clean
// state; the persisted preference is updated so a later reload stays consistent.
function resetFilterSectionsToDefault() {
    document.querySelectorAll('.filter-section').forEach(section => {
        const sectionId = section.dataset.sectionId;
        const shouldCollapse = sectionId === 'more';
        section.classList.toggle('collapsed', shouldCollapse);
        syncFilterSectionState(section);
        safeStorageSet(`filterSection_${sectionId}`, shouldCollapse);
    });
}

// Initialize filter sections from localStorage
function initializeFilterSections() {
    document.querySelectorAll('.filter-section').forEach(section => {
        const sectionId = section.dataset.sectionId;
        const isCollapsed = safeStorageGet(`filterSection_${sectionId}`) === 'true';

        if (isCollapsed || sectionId === 'more') {
            section.classList.add('collapsed');
        }
        syncFilterSectionState(section);

        // Bind the collapse toggle here instead of an inline onclick, so the CSP can
        // use a strict script-src 'self' (no 'unsafe-inline').
        const header = section.querySelector('.filter-header');
        if (header) {
            header.addEventListener('click', () => toggleFilterSection(header));
        }
    });
}

function resetAllFilters() {
    // Cancel any pending debounced search so it cannot re-filter after the reset.
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    searchInput.value = '';
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.classList.remove('active');
        button.disabled = false;
        button.classList.remove('disabled');
        updateToggleButtonState(button);
    });
    filteredFlags = [...flags];
    renderFlagGrid();
    updateFilterButtonStates(flags);
    updateFlagCounter(flags.length);
    updateQueryInUrl('');
}

function isEditableTarget(target) {
    if (!target) {
        return false;
    }

    const tagName = target.tagName?.toLowerCase();
    return tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || target.isContentEditable;
}

// Event Listeners
searchInput.addEventListener('input', (e) => debounceSearch(e.target.value));
if (resetFiltersButton) {
    resetFiltersButton.addEventListener('click', resetAllFilters);
}

const titleReset = document.getElementById('titleReset');
if (titleReset) {
    titleReset.addEventListener('click', () => {
        resetAllFilters();
        resetFilterSectionsToDefault();
    });
}

// Update event listeners for all filter types
document.querySelectorAll('.filter-btn[data-color]').forEach(button => {
    button.addEventListener('click', () => handleColorFilter(button.dataset.color));
});

document.querySelectorAll('.filter-btn[data-continent]').forEach(button => {
    button.addEventListener('click', () => handleContinentFilter(button.dataset.continent));
});

document.querySelectorAll('.filter-btn[data-pattern]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        updateToggleButtonState(button);
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-symbol]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        updateToggleButtonState(button);
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-motive]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        updateToggleButtonState(button);
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-people]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        updateToggleButtonState(button);
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-ideology]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        updateToggleButtonState(button);
        applyFilters();
    });
});

document.querySelectorAll('.filter-btn[data-text]').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        updateToggleButtonState(button);
        applyFilters();
    });
});

// Initialize the app
async function initApp() {
    initDarkMode();
    const initialLanguage = getInitialLanguage();
    await switchLanguage(initialLanguage);
    const loadedFlags = await fetchFlags();
    initializeFilterSections();
    // Only render once the data loaded; on fetch failure fetchFlags returns
    // undefined and leaves its own error message in the grid.
    if (loadedFlags) {
        applyInitialQueryFromUrl();
    }
}

if (languageSelect) {
    languageSelect.addEventListener('change', (event) => {
        switchLanguage(event.target.value);
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    if (isEditableTarget(event.target)) {
        return;
    }

    event.preventDefault();
    searchInput.focus();
    searchInput.select();
});

initApp();

// Info modal functionality
const infoButton = document.getElementById('infoButton');
const infoModal = document.getElementById('infoModal');
const closeBtn = infoModal.querySelector('.close-btn');

infoButton.addEventListener('click', () => {
    openModal(infoModal);
});

infoModal._closeHandler = () => closeModal(infoModal);

closeBtn.addEventListener('click', () => {
    closeModal(infoModal);
});

window.addEventListener('click', (event) => {
    if (event.target === infoModal) {
        closeModal(infoModal);
    }
});
