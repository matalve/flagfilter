// Entry point: wires up the DOM, event listeners and startup sequence.
// Feature logic lives in the js/ modules; this file is just the composition
// root. Split out of the old monolithic script.js; see #143.
import { state } from './js/state.js';
import { isEditableTarget } from './js/util.js';
import { getInitialLanguage, switchLanguage } from './js/i18n.js';
import { initLanguagePicker } from './js/language-picker.js';
import { fetchFlags } from './js/flags.js';
import {
    applyInitialQueryFromUrl,
    debounceSearch,
    initializeFilterSections,
    resetAllFilters,
    resetFilterSectionsToDefault,
    toggleFilterButton
} from './js/filters.js';
import { FILTER_KEYS } from './js/filter-config.js';
import { closeModal, openModal, showFlagInfoModal } from './js/modal.js';
import { initDarkMode } from './js/theme.js';
import { initScrollToTop } from './js/scroll-to-top.js';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const flagGrid = document.getElementById('flagGrid');
const resetFiltersButton = document.getElementById('resetFiltersButton');

// One delegated listener for every "Learn more" button, registered once on the
// grid instead of one listener per button on every render.
flagGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.learn-more-btn');
    if (!button) {
        return;
    }
    const flag = state.flagsByCode.get(button.dataset.code);
    if (flag) {
        showFlagInfoModal(flag);
    }
});

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

// Every filter button is a plain toggle. The kinds come from filter-config.js,
// so a new group cannot be silently inert here.
FILTER_KEYS.forEach((key) => {
    document.querySelectorAll(`.filter-btn[data-${key}]`).forEach((button) => {
        button.addEventListener('click', () => toggleFilterButton(button));
    });
});

// Initialize the app
async function initApp() {
    initDarkMode();
    initScrollToTop();
    const initialLanguage = getInitialLanguage();
    await switchLanguage(initialLanguage);
    // Renders from state.currentLanguage, so it goes after the initial switch.
    initLanguagePicker();
    const loadedFlags = await fetchFlags();
    initializeFilterSections();
    // Only render once the data loaded; on fetch failure fetchFlags returns
    // undefined and leaves its own error message in the grid.
    if (loadedFlags) {
        applyInitialQueryFromUrl();
    }
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
