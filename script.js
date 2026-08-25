// Entry point: wires up the DOM, event listeners and startup sequence.
// Feature logic lives in the js/ modules; this file is just the composition
// root. Split out of the old monolithic script.js; see #143.
import { state } from './js/state.js';
import { isEditableTarget, updateToggleButtonState } from './js/util.js';
import { getInitialLanguage, switchLanguage } from './js/i18n.js';
import { fetchFlags } from './js/flags.js';
import {
    applyFilters,
    applyInitialQueryFromUrl,
    debounceSearch,
    handleColorFilter,
    handleContinentFilter,
    initializeFilterSections,
    resetAllFilters,
    resetFilterSectionsToDefault
} from './js/filters.js';
import { closeModal, openModal, showFlagInfoModal } from './js/modal.js';
import { initDarkMode } from './js/theme.js';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const flagGrid = document.getElementById('flagGrid');
const resetFiltersButton = document.getElementById('resetFiltersButton');
const languageToggle = document.getElementById('languageToggle');

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

// Update event listeners for all filter types
document.querySelectorAll('.filter-btn[data-color]').forEach(button => {
    button.addEventListener('click', () => handleColorFilter(button.dataset.color));
});

document.querySelectorAll('.filter-btn[data-continent]').forEach(button => {
    button.addEventListener('click', () => handleContinentFilter(button.dataset.continent));
});

// Colour and continent have their own handlers above; every other kind is a
// plain toggle, so they share one. Was seven copies of the same three lines,
// which is how a new filter kind ends up silently inert — adding one is now a
// word in this list.
['pattern', 'symbol', 'motive', 'people', 'ideology', 'text', 'family'].forEach((kind) => {
    document.querySelectorAll(`.filter-btn[data-${kind}]`).forEach(button => {
        button.addEventListener('click', () => {
            button.classList.toggle('active');
            updateToggleButtonState(button);
            applyFilters();
        });
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

if (languageToggle) {
    languageToggle.addEventListener('click', () => {
        switchLanguage(languageToggle.dataset.targetLanguage);
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
