// Search, filters and URL query state: the search box, color/continent
// filters, filter-section collapse, reset, and syncing ?q= with the UI.
// Split out of script.js; see #143.
import { state } from './state.js';
import {
    hasTextValue,
    normalizeQueryValue,
    safeStorageGet,
    safeStorageSet,
    updateToggleButtonState
} from './util.js';
import { renderFlagGrid, updateFlagCounter } from './flags.js';

const searchInput = document.getElementById('searchInput');

const QUERY_FILTER_DATA_KEYS = ['color', 'continent', 'pattern', 'symbol', 'motive', 'people', 'ideology', 'text'];

function getQueryFromUrl() {
    return new URLSearchParams(window.location.search).get('q') || '';
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

export function applyInitialQueryFromUrl() {
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

// Search is debounced so typing does not trigger a filter pass plus grid render
// per keystroke; it settles ~150 ms after the last input. See #142.
export const SEARCH_DEBOUNCE_MS = 150;

export function debounceSearch(query) {
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
        state.searchDebounceTimer = null;
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

    state.filteredFlags = state.flags.filter((flag) => matchesSearchTerm(flag, normalizedTerm));
    applyFilters();
}

// Apply all active filters
export function applyFilters() {
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
        ? [...state.flags]
        : state.flags.filter((flag) => matchesSearchTerm(flag, normalizedTerm));

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

    state.filteredFlags = results;
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
export function handleColorFilter(color) {
    if (color) {
        const button = document.querySelector(`[data-color="${color}"]`);
        button.classList.toggle('active');
        updateToggleButtonState(button);
    }

    applyFilters();
}

export function handleContinentFilter(continent) {
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
export function resetFilterSectionsToDefault() {
    document.querySelectorAll('.filter-section').forEach(section => {
        const sectionId = section.dataset.sectionId;
        const shouldCollapse = sectionId === 'more';
        section.classList.toggle('collapsed', shouldCollapse);
        syncFilterSectionState(section);
        safeStorageSet(`filterSection_${sectionId}`, shouldCollapse);
    });
}

// Initialize filter sections from localStorage
export function initializeFilterSections() {
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

export function resetAllFilters() {
    // Cancel any pending debounced search so it cannot re-filter after the reset.
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = null;
    searchInput.value = '';
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.classList.remove('active');
        button.disabled = false;
        button.classList.remove('disabled');
        updateToggleButtonState(button);
    });
    state.filteredFlags = [...state.flags];
    renderFlagGrid();
    updateFilterButtonStates(state.flags);
    updateFlagCounter(state.flags.length);
    updateQueryInUrl('');
}
