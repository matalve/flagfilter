// DOM Elements
const searchInput = document.getElementById('searchInput');
const flagGrid = document.getElementById('flagGrid');
const resetFiltersButton = document.getElementById('resetFiltersButton');
const languageSelect = document.getElementById('languageSelect');

// Global variables
let flags = [];
let filteredFlags = [];
let baseFlagInfo = [];
let uiTranslations = {};
let fallbackUiTranslations = {};
let flagTranslations = {};
let currentLanguage = 'en';
const SUPPORTED_LANGUAGES = ['en', 'es'];
const DEFAULT_LANGUAGE = 'en';

function getLanguageFromUrl() {
    const lang = new URLSearchParams(window.location.search).get('lang');
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
}

function getInitialLanguage() {
    const queryLanguage = getLanguageFromUrl();
    if (queryLanguage) {
        return queryLanguage;
    }

    const savedLanguage = localStorage.getItem('language');
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
    const icon = button.querySelector('i');
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

// Dark mode toggle functionality
function initDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    // Check if user has a saved preference
    const savedDarkMode = localStorage.getItem('darkMode');
    
    // Apply saved preference or use system preference
    if (savedDarkMode !== null) {
        // User has a saved preference
        if (savedDarkMode === 'true') {
            document.body.classList.add('dark-mode');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            document.body.classList.remove('dark-mode');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    } else {
        // No saved preference, check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            // Save this preference
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            // Save this preference
            localStorage.setItem('darkMode', 'false');
        }
    }
    
    // Toggle dark mode
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        // Update icons
        if (document.body.classList.contains('dark-mode')) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            // Save preference
            localStorage.setItem('darkMode', 'true');
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            // Save preference
            localStorage.setItem('darkMode', 'false');
        }
    });
}

// Predefined flag colors database
const flagColors = {
    'af': ['black', 'red', 'green'],
    'al': ['red', 'black'],
    'dz': ['green', 'white', 'red'],
    'ad': ['blue', 'yellow', 'red'],
    'ao': ['red', 'black', 'yellow'],
    'ag': ['red', 'blue', 'yellow', 'white', 'black'],
    'ar': ['blue', 'white'],
    'am': ['red', 'blue', 'orange'],
    'au': ['blue', 'red', 'white'],
    'at': ['red', 'white'],
    'az': ['blue', 'red', 'green'],
    'bs': ['blue', 'yellow', 'black'],
    'bh': ['red', 'white'],
    'bd': ['green', 'red'],
    'bb': ['blue', 'yellow', 'black'],
    'by': ['red', 'green', 'white'],
    'be': ['black', 'yellow', 'red'],
    'bz': ['blue', 'red', 'white'],
    'bj': ['green', 'yellow', 'red'],
    'bt': ['yellow', 'orange', 'white'],
    'bo': ['red', 'yellow', 'green'],
    'ba': ['blue', 'yellow', 'white'],
    'bw': ['blue', 'white', 'black'],
    'br': ['green', 'yellow', 'blue', 'white'],
    'bn': ['yellow', 'black', 'white', 'red'],
    'bg': ['white', 'green', 'red'],
    'bf': ['red', 'green', 'yellow'],
    'bi': ['red', 'white', 'green'],
    'kh': ['blue', 'red', 'white'],
    'cm': ['green', 'red', 'yellow', 'white'],
    'ca': ['red', 'white'],
    'cv': ['blue', 'white', 'red', 'yellow'],
    'cf': ['blue', 'white', 'green', 'yellow', 'red'],
    'td': ['blue', 'yellow', 'red'],
    'cl': ['red', 'white', 'blue'],
    'cn': ['red', 'yellow'],
    'co': ['yellow', 'blue', 'red'],
    'km': ['green', 'white', 'red', 'yellow', 'blue'],
    'cg': ['green', 'yellow', 'red'],
    'cd': ['blue', 'yellow', 'red'],
    'cr': ['blue', 'white', 'red'],
    'ci': ['orange', 'white', 'green'],
    'hr': ['red', 'white', 'blue'],
    'cu': ['blue', 'white', 'red'],
    'cy': ['white', 'yellow', 'green'],
    'cz': ['white', 'red', 'blue'],
    'dk': ['red', 'white'],
    'dj': ['blue', 'green', 'white', 'red'],
    'dm': ['green', 'yellow', 'black', 'red', 'white'],
    'do': ['blue', 'red', 'white'],
    'ec': ['yellow', 'blue', 'red'],
    'eg': ['red', 'white', 'black'],
    'sv': ['blue', 'white'],
    'gq': ['green', 'white', 'red', 'blue'],
    'er': ['green', 'red', 'blue', 'yellow'],
    'ee': ['blue', 'black', 'white'],
    'et': ['green', 'yellow', 'red', 'blue'],
    'fj': ['blue', 'red', 'white'],
    'fi': ['white', 'blue'],
    'fr': ['blue', 'white', 'red'],
    'ga': ['green', 'yellow', 'blue'],
    'gm': ['red', 'blue', 'green', 'white'],
    'ge': ['white', 'red'],
    'de': ['black', 'red', 'yellow'],
    'gh': ['red', 'yellow', 'green', 'black'],
    'gr': ['blue', 'white'],
    'gd': ['red', 'yellow', 'green', 'white'],
    'gt': ['blue', 'white'],
    'gn': ['red', 'yellow', 'green'],
    'gw': ['yellow', 'green', 'red', 'black'],
    'gy': ['green', 'white', 'yellow', 'red', 'black'],
    'ht': ['blue', 'red', 'white'],
    'hn': ['blue', 'white'],
    'hu': ['red', 'white', 'green'],
    'is': ['blue', 'white', 'red'],
    'in': ['orange', 'white', 'green'],
    'id': ['red', 'white'],
    'ir': ['green', 'white', 'red'],
    'iq': ['red', 'white', 'black', 'green'],
    'ie': ['green', 'white', 'orange'],
    'il': ['blue', 'white'],
    'it': ['green', 'white', 'red'],
    'jm': ['green', 'yellow', 'black'],
    'jp': ['white', 'red'],
    'jo': ['black', 'white', 'green', 'red'],
    'kz': ['blue', 'yellow'],
    'ke': ['black', 'red', 'green', 'white'],
    'ki': ['red', 'blue', 'white', 'yellow'],
    'kp': ['red', 'white', 'blue'],
    'kr': ['white', 'red', 'blue', 'black'],
    'kw': ['green', 'white', 'red', 'black'],
    'kg': ['red', 'yellow'],
    'la': ['red', 'blue', 'white'],
    'lv': ['red', 'white'],
    'lb': ['red', 'white', 'green'],
    'ls': ['blue', 'white', 'green', 'black'],
    'lr': ['red', 'white', 'blue', 'white'],
    'ly': ['red', 'black', 'green', 'white'],
    'li': ['red', 'blue'],
    'lt': ['yellow', 'green', 'red'],
    'lu': ['red', 'white', 'blue'],
    'mg': ['white', 'red', 'green'],
    'mw': ['black', 'red', 'green'],
    'my': ['red', 'white', 'blue', 'yellow'],
    'mv': ['red', 'green', 'white'],
    'ml': ['green', 'yellow', 'red'],
    'mt': ['white', 'red'],
    'mh': ['blue', 'white', 'orange'],
    'mr': ['green', 'yellow', 'red'],
    'mu': ['red', 'blue', 'yellow', 'green'],
    'mx': ['green', 'white', 'red'],
    'fm': ['blue', 'white'],
    'md': ['blue', 'yellow', 'red'],
    'mc': ['red', 'white'],
    'mn': ['red', 'blue', 'yellow'],
    'me': ['red', 'yellow'],
    'ma': ['red', 'green'],
    'mz': ['green', 'black', 'yellow', 'white', 'red'],
    'mm': ['yellow', 'green', 'red', 'white'],
    'na': ['blue', 'red', 'green', 'white', 'yellow'],
    'nr': ['blue', 'yellow', 'white'],
    'np': ['red', 'blue', 'white'],
    'nl': ['red', 'white', 'blue'],
    'nz': ['blue', 'white', 'red'],
    'ni': ['blue', 'white'],
    'ne': ['orange', 'white', 'green'],
    'ng': ['green', 'white', 'green'],
    'no': ['red', 'white', 'blue'],
    'om': ['red', 'white', 'green'],
    'pk': ['green', 'white'],
    'pw': ['blue', 'yellow'],
    'pa': ['white', 'blue', 'red'],
    'pg': ['red', 'black', 'yellow'],
    'py': ['red', 'white', 'blue'],
    'pe': ['red', 'white'],
    'ph': ['blue', 'red', 'yellow', 'white'],
    'pl': ['white', 'red'],
    'pt': ['red', 'green'],
    'qa': ['white', 'red'],
    'ro': ['blue', 'yellow', 'red'],
    'ru': ['white', 'blue', 'red'],
    'rw': ['blue', 'yellow', 'green'],
    'kn': ['green', 'yellow', 'black', 'red', 'white'],
    'lc': ['blue', 'yellow', 'black', 'white', 'red'],
    'vc': ['blue', 'yellow', 'green', 'white', 'red'],
    'ws': ['red', 'white', 'blue'],
    'sm': ['white', 'blue'],
    'st': ['green', 'yellow', 'red', 'black'],
    'sa': ['green', 'white'],
    'sn': ['green', 'yellow', 'red'],
    'rs': ['red', 'blue', 'white'],
    'sc': ['blue', 'yellow', 'red', 'white', 'green'],
    'sl': ['green', 'white', 'blue'],
    'sg': ['red', 'white'],
    'sk': ['white', 'blue', 'red'],
    'si': ['white', 'blue', 'red'],
    'sb': ['blue', 'yellow', 'green', 'white'],
    'so': ['blue', 'white'],
    'za': ['red', 'blue', 'green', 'yellow', 'white', 'black'],
    'ss': ['black', 'red', 'green', 'blue', 'yellow', 'white'],
    'es': ['red', 'yellow'],
    'lk': ['red', 'green', 'yellow', 'orange'],
    'sd': ['red', 'white', 'black', 'green'],
    'sr': ['green', 'white', 'red', 'yellow'],
    'sz': ['blue', 'yellow', 'red', 'white', 'black'],
    'se': ['blue', 'yellow'],
    'ch': ['red', 'white'],
    'sy': ['red', 'white', 'black', 'green'],
    'tw': ['red', 'blue', 'white'],
    'tj': ['red', 'white', 'green'],
    'tz': ['green', 'yellow', 'blue', 'black'],
    'th': ['red', 'white', 'blue'],
    'tl': ['red', 'yellow', 'black', 'white'],
    'tg': ['green', 'yellow', 'red', 'white'],
    'to': ['red', 'white'],
    'tt': ['red', 'white', 'black'],
    'tn': ['red', 'white'],
    'tr': ['red', 'white'],
    'tm': ['green', 'red', 'white', 'yellow'],
    'tv': ['blue', 'yellow', 'white', 'red'],
    'ug': ['black', 'yellow', 'red'],
    'ua': ['blue', 'yellow'],
    'ae': ['green', 'white', 'black', 'red'],
    'gb': ['blue', 'white', 'red'],
    'us': ['red', 'white', 'blue'],
    'uy': ['white', 'blue', 'yellow'],
    'uz': ['blue', 'white', 'red', 'green'],
    'vu': ['red', 'green', 'yellow', 'black', 'white'],
    'va': ['yellow', 'white'],
    've': ['yellow', 'blue', 'red', 'white'],
    'vn': ['red', 'yellow'],
    'ye': ['red', 'white', 'black'],
    'zm': ['green', 'red', 'black', 'yellow', 'orange'],
    'zw': ['green', 'yellow', 'red', 'black', 'white'],
    'eu': ['blue', 'yellow', 'white']
};

// Continent data structure
const continentData = {
    'africa': ['dz', 'ao', 'bj', 'bw', 'bf', 'bi', 'cm', 'cv', 'cf', 'td', 'km', 'cg', 'cd', 'ci', 'dj', 'eg', 'gq', 'er', 'et', 'ga', 'gm', 'gh', 'gn', 'gw', 'ke', 'ls', 'lr', 'ly', 'mg', 'mw', 'ml', 'mr', 'mu', 'mz', 'na', 'ne', 'ng', 'rw', 'st', 'sn', 'sc', 'sl', 'so', 'za', 'ss', 'sd', 'sz', 'tz', 'tg', 'tn', 'ug', 'zm', 'zw'],
    'asia': ['af', 'am', 'az', 'bh', 'bd', 'bt', 'bn', 'kh', 'cn', 'ge', 'in', 'id', 'ir', 'iq', 'il', 'jp', 'jo', 'kz', 'kw', 'kg', 'la', 'lb', 'my', 'mv', 'mn', 'mm', 'np', 'om', 'pk', 'ph', 'qa', 'sa', 'sg', 'kr', 'lk', 'sy', 'tw', 'tj', 'th', 'tl', 'tr', 'tm', 'ae', 'uz', 'vn', 'ye'],
    'europe': ['al', 'ad', 'at', 'by', 'be', 'ba', 'bg', 'hr', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'is', 'ie', 'it', 'lv', 'li', 'lt', 'lu', 'mt', 'md', 'mc', 'me', 'nl', 'mk', 'no', 'pl', 'pt', 'ro', 'ru', 'sm', 'rs', 'sk', 'si', 'es', 'se', 'ch', 'ua', 'gb', 'va'],
    'northAmerica': ['ag', 'bs', 'bb', 'bz', 'ca', 'cr', 'cu', 'dm', 'do', 'sv', 'gd', 'gt', 'ht', 'hn', 'jm', 'mx', 'ni', 'pa', 'tt', 'us'],
    'southAmerica': ['ar', 'bo', 'br', 'cl', 'co', 'ec', 'gy', 'py', 'pe', 'sr', 'uy', 've'],
    'oceania': ['au', 'fj', 'ki', 'mh', 'nr', 'nz', 'pw', 'pg', 'ws', 'sb', 'to', 'tv', 'vu']
};

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
        const url = `https://flagcdn.com/w320/${code}.png`;
        const tags = info.tags || '';
        const colorTags = ['red', 'blue', 'green', 'yellow', 'white', 'black'];
        const colors = colorTags.filter(color => tags.includes(color));

        return {
            code,
            url,
            name: info.name || code.toUpperCase(),
            colors: colors.length > 0 ? colors : extractColorsFromUrl(url),
            tags: tags.split(' '),
            info
        };
    });
}

// Fetch flag data from local source and apply translations
async function fetchFlags() {
    try {
        const flagInfoResponse = await fetch('flaginfo.json');
        baseFlagInfo = await flagInfoResponse.json();
        rebuildFlags();
        
        filteredFlags = [...flags];
        renderFlagGrid();

        return flags;
    } catch (error) {
        console.error('Error fetching flag data:', error);
        flagGrid.innerHTML = `<p class="error">${t('error_loading_flags')}</p>`;
    }
}

// Extract colors from flag URL (fallback method)
function extractColorsFromUrl(url) {
    // This is a simplified version of the original function
    // We'll use the tags from flaginfo.json as the primary source
    return [];
}

function applyStaticTranslations() {
    document.documentElement.lang = currentLanguage;
    document.title = t('page_title');
    searchInput.placeholder = t('search_placeholder');
    searchInput.setAttribute('aria-label', t('search_input_aria'));
    resetFiltersButton.innerHTML = `<i class="fas fa-rotate-left"></i> ${t('reset_button')}`;
    resetFiltersButton.setAttribute('aria-label', t('reset_button_aria'));

    const infoButton = document.getElementById('infoButton');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const infoModal = document.getElementById('infoModal');
    infoButton.setAttribute('aria-label', t('info_button_aria'));
    darkModeToggle.setAttribute('aria-label', t('dark_mode_aria'));

    const filterHeaders = document.querySelectorAll('.filter-section > .filter-header .filter-title');
    if (filterHeaders[0]) filterHeaders[0].textContent = t('filter_by_color');
    if (filterHeaders[1]) filterHeaders[1].textContent = t('more_filters');

    const groupHeadings = document.querySelectorAll('.compact-filter-group h4');
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
    localStorage.setItem('language', language);
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

// Render flag grid
function renderFlagGrid() {
    flagGrid.innerHTML = '';
    
    if (filteredFlags.length === 0) {
        flagGrid.innerHTML = `<p class="no-results">${t('no_results')}</p>`;
        updateFlagCounter(0);
        return;
    }
    
    filteredFlags.forEach(flag => {
        const flagCard = document.createElement('div');
        flagCard.className = 'flag-card';
        
        flagCard.innerHTML = `
            <img src="${flag.url}" alt="${flag.name} flag" loading="lazy">
            <h3>${flag.name}</h3>
            <button class="learn-more-btn" data-code="${flag.code}" aria-haspopup="dialog">${t('learn_more')}</button>
        `;
        
        flagGrid.appendChild(flagCard);
    });
    
    updateFlagCounter(filteredFlags.length);
    
    // Add event listeners to all "Learn more" buttons
    document.querySelectorAll('.learn-more-btn').forEach(button => {
        button.addEventListener('click', () => {
            const flagCode = button.getAttribute('data-code');
            const flag = flags.find(f => f.code === flagCode);
            if (flag) {
                showFlagInfoModal(flag);
            }
        });
    });
}

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
    modal._closeHandler = () => closeDynamicModal(modal);
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', t('close'));
    closeBtn.addEventListener('click', () => {
        closeDynamicModal(modal);
    });
    
    // Create flag image
    const flagImage = document.createElement('img');
    flagImage.src = flag.url;
    flagImage.alt = `${flag.name} flag`;
    flagImage.className = 'modal-flag-image';
    
    // Create flag information
    const flagInfo = document.createElement('div');
    flagInfo.className = 'flag-info-details';
    flagInfo.id = 'flagModalDescription';
    
    // Process HTML content to make links clickable
    const processedSymbolism = processHtmlContent(flag.info.symbolism || t('no_information_available'));
    const processedFunfacts = processHtmlContent(flag.info.funfacts || t('no_fun_facts_available'));
    
    // Add flag information
    flagInfo.innerHTML = `
        <h2 id="flagModalTitle">${flag.name}</h2>
        <p><strong>${t('adopted_label')}:</strong> ${flag.info.adopted || t('unknown')}</p>
        <p><strong>${t('symbolism_label')}:</strong> ${processedSymbolism}</p>
        <p><strong>${t('fun_facts_label')}:</strong> ${processedFunfacts}</p>
        <p><strong>${t('colors_label')}:</strong> ${flag.colors.join(', ')}</p>
        <div class="modal-actions">
            <a href="${flag.info.wikipedialink}" target="_blank" rel="noopener noreferrer" class="wiki-link">${t('read_more_wikipedia')}</a>
            <button class="report-issue-btn" aria-expanded="false" aria-controls="reportFormPanel">${t('report_issue')}</button>
        </div>
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
            <input type="hidden" name="flagName" value="${flag.name}">
            
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
                    placeholder="${t('issue_description_placeholder')}"></textarea>
            </div>
            
            <div class="form-group">
                <label for="userEmail">${t('your_email_optional_label')}:</label>
                <input type="email" name="userEmail" id="userEmail" 
                    placeholder="${t('email_placeholder')}">
            </div>
            
            <div class="form-actions">
                <button type="submit" class="submit-btn">${t('submit_report')}</button>
                <button type="button" class="cancel-btn">${t('cancel')}</button>
            </div>
        </form>
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
    reportBtn.addEventListener('click', () => {
        reportForm.style.display = 'block';
        reportBtn.style.display = 'none';
        reportBtn.setAttribute('aria-expanded', 'true');
        const firstField = reportForm.querySelector('#issueType');
        if (firstField) {
            firstField.focus();
        }
    });
    
    // Handle form submission
    const form = reportForm.querySelector('#reportForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch('/api/report-issue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert(t('report_success'));
                reportForm.style.display = 'none';
                reportBtn.style.display = 'inline-flex';
                reportBtn.setAttribute('aria-expanded', 'false');
                reportBtn.focus();
            } else {
                throw new Error(result.error || t('failed_to_submit_report'));
            }
        } catch (error) {
            alert(t('report_error'));
            console.error('Error submitting report:', error);
        }
    });
    
    // Handle cancel button
    const cancelBtn = reportForm.querySelector('.cancel-btn');
    cancelBtn.addEventListener('click', () => {
        reportForm.style.display = 'none';
        reportBtn.style.display = 'inline-flex';
        reportBtn.setAttribute('aria-expanded', 'false');
        reportBtn.focus();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDynamicModal(modal);
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
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '+');

    // Replace links with ?q= parameter to make them open the flag modal.
    // Use baseFlagInfo (English source names) for lookup so translated UI names do not break links.
    return htmlContent.replace(/<a href="\?q=([^"]+)">([^<]+)<\/a>/g, (match, queryValue, linkText) => {
        const normalizedQuery = normalizeForQuery(queryValue);

        const matchedBaseFlag = baseFlagInfo.find((info) =>
            normalizeForQuery(info.name) === normalizedQuery
        );

        if (matchedBaseFlag) {
            return `<a href="#" class="flag-link" data-flag-code="${matchedBaseFlag.shortname}">${linkText}</a>`;
        }

        const matchedByCode = flags.find((flag) => flag.code.toLowerCase() === queryValue.toLowerCase());
        if (matchedByCode) {
            return `<a href="#" class="flag-link" data-flag-code="${matchedByCode.code}">${linkText}</a>`;
        }

        return linkText;
    });
}

// Search functionality
function handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (searchTerm === '') {
        // If search is empty, apply only color/continent filters
        applyFilters();
        return;
    }
    
    // Filter flags based on search term
    filteredFlags = flags.filter(flag => 
        flag.name.toLowerCase().includes(searchTerm) || 
        flag.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
    
    // Apply active filters to search results
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
    
    // Start with all flags or search results
    let results = searchTerm === '' ? [...flags] : 
        flags.filter(flag => 
            flag.name.toLowerCase().includes(searchTerm) || 
            flag.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    
    // Apply color filters
    if (activeColors.length > 0) {
        results = results.filter(flag => 
            activeColors.every(color => flag.colors.includes(color))
        );
    }
    
    // Apply continent filters
    if (activeContinents.length > 0) {
        results = results.filter(flag => {
            return activeContinents.some(continent => {
                return continentData[continent].includes(flag.code);
            });
        });
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
}

function updateFilterButtonStates(currentResults) {
    // Reset all buttons to enabled state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
    });

    // Check each filter type
    const filterTypes = ['color', 'continent', 'pattern', 'symbol', 'motive', 'people', 'ideology', 'text'];
    
    filterTypes.forEach(type => {
        const buttons = document.querySelectorAll(`.filter-btn[data-${type}]`);
        buttons.forEach(button => {
            const value = button.dataset[type];
            let wouldHaveResults = false;

            // Create a copy of current results to test
            let testResults = [...currentResults];

            // Test if adding this filter would still show results
            if (type === 'color') {
                wouldHaveResults = testResults.some(flag => flag.colors.includes(value));
            } else if (type === 'continent') {
                wouldHaveResults = testResults.some(flag => continentData[value].includes(flag.code));
            } else {
                wouldHaveResults = testResults.some(flag => flag.tags.includes(value));
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
    const section = header.parentElement;
    section.classList.toggle('collapsed');
    
    // Save the state to localStorage using a stable key that does not change with translations
    const sectionId = section.dataset.sectionId;
    const isCollapsed = section.classList.contains('collapsed');
    syncFilterSectionState(section);
    localStorage.setItem(`filterSection_${sectionId}`, isCollapsed);
}

// Initialize filter sections from localStorage
function initializeFilterSections() {
    document.querySelectorAll('.filter-section').forEach(section => {
        const sectionId = section.dataset.sectionId;
        const isCollapsed = localStorage.getItem(`filterSection_${sectionId}`) === 'true';
        
        if (isCollapsed || sectionId === 'more') {
            section.classList.add('collapsed');
        }
        syncFilterSectionState(section);
    });
}

function resetAllFilters() {
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
searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
if (resetFiltersButton) {
    resetFiltersButton.addEventListener('click', resetAllFilters);
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
    await fetchFlags();
    initializeFilterSections();
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
