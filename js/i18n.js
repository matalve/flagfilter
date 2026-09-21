// Translations and language handling: UI strings (i18n/*.json), per-flag
// translations via rebuildFlags, and the language switcher. Split out of
// script.js; see #143.
import { state } from './state.js';
import {
    hasTextValue,
    loadJson,
    safeStorageGet,
    safeStorageSet,
    setButtonLabel,
    updateAllToggleButtonStates
} from './util.js';
import { t } from './translate.js';
import { rebuildFlags } from './flags.js';
import { applyFilters } from './filters.js';
import { FILTER_GROUPS } from './filter-config.js';

// Looked up inside the functions that use them rather than at import time; see
// the note in filters.js and #143.

export const SUPPORTED_LANGUAGES = ['en', 'es'];
// Which flag stands for which language in the header picker. A flag is a country
// and a language is not, so these are choices rather than facts: English is shown
// as the Union Jack, Spanish as Spain.
export const LANGUAGE_FLAGS = { en: 'gb', es: 'es' };
// Each language named in itself, which is what a reader looking for their own
// language recognises. These are not translated.
export const LANGUAGE_NAMES = { en: 'English', es: 'Español' };
const DEFAULT_LANGUAGE = 'en';

function getLanguageFromUrl() {
    const lang = new URLSearchParams(window.location.search).get('lang');
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
}

export function getInitialLanguage() {
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

async function loadTranslations(language) {
    state.fallbackUiTranslations = await loadJson('i18n/ui/en.json', {});
    state.uiTranslations = language === 'en'
        ? state.fallbackUiTranslations
        : await loadJson(`i18n/ui/${language}.json`, state.fallbackUiTranslations);

    state.flagTranslations = language === 'en'
        ? {}
        : await loadJson(`i18n/flags/${language}.json`, {});
}

function applyStaticTranslations() {
    document.documentElement.lang = state.currentLanguage;
    document.title = t('page_title');
    const searchInput = document.getElementById('searchInput');
    const resetFiltersButton = document.getElementById('resetFiltersButton');
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

    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        scrollToTopBtn.setAttribute('aria-label', t('scroll_to_top_aria'));
    }

    const filterHeaders = document.querySelectorAll('.filter-section .filter-header .filter-title');
    if (filterHeaders[0]) filterHeaders[0].textContent = t('filter_by_color');
    if (filterHeaders[1]) filterHeaders[1].textContent = t('more_filters');

    FILTER_GROUPS.forEach((group) => {
        if (group.heading) {
            // The <h3> sits beside the group's button container, so find it from
            // there rather than by position in the page.
            const heading = document.querySelector(`.${group.key}-filters`)
                ?.closest('.compact-filter-group')
                ?.querySelector('h3');
            if (heading) {
                heading.textContent = t(group.heading);
            }
        }
        document.querySelectorAll(`.filter-btn[data-${group.key}]`).forEach((button) => {
            setButtonLabel(button, t(`${group.key}_${button.dataset[group.key]}`));
        });
    });

    const closeBtn = infoModal.querySelector('.close-btn');
    const infoTitle = infoModal.querySelector('h2');
    const infoContent = infoModal.querySelector('.info-content');
    const translationDisclaimer = state.currentLanguage === 'es'
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

export async function switchLanguage(language) {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
        return;
    }

    state.currentLanguage = language;
    safeStorageSet('language', language);
    updateLanguageInUrl(language);
    await loadTranslations(language);
    applyStaticTranslations();

    if (state.baseFlagInfo.length > 0) {
        rebuildFlags();
        applyFilters();
    }

}
