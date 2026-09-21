// Search, filters and URL query state: the search box, color/continent
// filters, filter-section collapse, reset, and syncing ?q= with the UI.
// Split out of script.js; see #143.
import { state } from './state.js';
import {
    hasTextValue,
    normalizeQueryValue,
    safeStorageGet,
    safeStorageSet
} from './util.js';
import { renderFlagGrid } from './flags.js';
import { FILTER_GROUPS, flagHasValue } from './filter-config.js';

// Looked up on demand rather than captured at import time. A module that grabs
// DOM nodes while it is being imported can only ever be loaded into a browser
// with the page already parsed, which rules out unit-testing this file's pure
// logic under Node (see #141). See #143.
function searchInput() {
    return document.getElementById('searchInput');
}

// Module-local: this is a private timer handle, not shared app state.
let searchDebounceTimer = null;

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

// Every filter value with the spellings ?q= accepts for it, built once from the
// config rather than read off the buttons on every query.
const QUERY_ENTRIES = FILTER_GROUPS.flatMap((group) => group.values.map((value) => {
    const normalizedValue = normalizeQueryValue(value);
    return {
        key: group.key,
        value,
        aliases: new Set([normalizedValue, normalizedValue.replace(/\s+/g, '')])
    };
}));

export function createEmptyFilters() {
    return Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, new Set()]));
}

function matchesSearchTerm(flag, normalizedTerm) {
    // The term is normalized once per filter pass, not once per flag comparison.
    // An empty normalized term here means the input only contained characters
    // the normalization strips (e.g. punctuation) and matches nothing; a truly
    // empty search is handled by applyFilters and shows all flags.
    return normalizedTerm !== '' && flag.searchText.includes(normalizedTerm);
}

// ?q= carries the whole filter state: active values in config order, then the
// search words.
function syncQueryParamFromState() {
    const filterTokens = FILTER_GROUPS.flatMap((group) => (
        group.values.filter((value) => state.filters[group.key].has(value))
    ));
    const searchTokens = state.search
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    updateQueryInUrl([...filterTokens, ...searchTokens].join(' '));
}

// Split a raw ?q= string into the filter values it names and the words left
// over as search text. Longest phrase first, so a multi-word filter value wins
// over its individual words.
function resolveQuery(rawQuery) {
    const rawWords = rawQuery.trim().split(/\s+/).filter(Boolean);
    const filters = createEmptyFilters();
    const matched = new Set();
    const remainingSearchTerms = [];

    for (let index = 0; index < rawWords.length;) {
        let matchedEntry = null;

        for (let end = rawWords.length; end > index; end -= 1) {
            const phrase = normalizeQueryValue(rawWords.slice(index, end).join(' '));
            const entry = QUERY_ENTRIES.find((candidate) => (
                !matched.has(candidate) && candidate.aliases.has(phrase)
            ));

            if (entry) {
                matchedEntry = { entry, end };
                break;
            }
        }

        if (matchedEntry) {
            matched.add(matchedEntry.entry);
            filters[matchedEntry.entry.key].add(matchedEntry.entry.value);
            index = matchedEntry.end;
            continue;
        }

        remainingSearchTerms.push(rawWords[index]);
        index += 1;
    }

    return { filters, matchedCount: matched.size, search: remainingSearchTerms.join(' ') };
}

// Does this ?q= name at least one filter? Used to decide whether a link in flag
// prose is worth keeping as a link. See #141.
export function queryMatchesAnyFilter(rawQuery) {
    if (!hasTextValue(rawQuery)) {
        return false;
    }

    return resolveQuery(rawQuery).matchedCount > 0;
}

// Replace the whole filter state with what a ?q= string names. The search box
// is written from state here, not read: while typing, the box leads and the
// debounced handler copies it into state.search.
function setStateFromQuery(rawQuery) {
    const { filters, search } = resolveQuery(rawQuery);
    state.filters = filters;
    state.search = search;
    searchInput().value = search;
}

// Used by the filter links inside flag prose: following one should land the
// reader on exactly that view, not on it plus their leftover filters.
export function applyQueryAsFilterState(rawQuery) {
    setStateFromQuery(rawQuery);
    applyFilters();
}

export function applyInitialQueryFromUrl() {
    const rawQuery = getQueryFromUrl();

    if (hasTextValue(rawQuery)) {
        setStateFromQuery(rawQuery);
    }

    // Render once, after the initial filter/search state is resolved, so the first
    // paint (and the eager / high-priority LCP image) reflects the real above-the-fold
    // flag instead of the unfiltered list. See PR #115.
    applyFilters();
}

// Search is debounced so typing does not trigger a filter pass plus grid render
// per keystroke; it settles ~150 ms after the last input. See #142.
export const SEARCH_DEBOUNCE_MS = 150;

// State takes the text at once so a filter click inside the debounce window
// still sees what the box says; only the filter pass waits.
export function debounceSearch(query) {
    state.search = query;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        searchDebounceTimer = null;
        applyFilters();
    }, SEARCH_DEBOUNCE_MS);
}

// Compute the result set from state, then render everything that depends on
// it: the grid, the buttons and the URL.
export function applyFilters() {
    // Normalize once per filter pass instead of once per flag (see matchesSearchTerm).
    const normalizedTerm = normalizeQueryValue(state.search);

    let results = state.search.trim() === ''
        ? [...state.flags]
        : state.flags.filter((flag) => matchesSearchTerm(flag, normalizedTerm));

    // Every active value must match (see filter-config.js). Flag family reads a
    // curated tag rather than the colour set: a flag carrying red, black, white
    // and green is not thereby pan-Arab, so the palette cannot stand in for the
    // tradition. See #141.
    FILTER_GROUPS.forEach((group) => {
        const active = [...state.filters[group.key]];
        if (active.length === 0) {
            return;
        }
        results = results.filter((flag) => active.every((value) => flagHasValue(flag, group, value)));
    });

    state.filteredFlags = results;
    renderFlagGrid();
    renderFilterButtons(results);
    syncQueryParamFromState();
}

// The buttons reflect state.filters; they are not where it lives.
function renderFilterButtons(currentResults) {
    // Index the values present in the current results once (O(flags)) so each
    // filter-button test below is an O(1) lookup instead of an O(flags) scan.
    const available = {};
    FILTER_GROUPS.forEach((group) => {
        available[group.field] = available[group.field] || new Set();
    });
    currentResults.forEach((flag) => {
        Object.entries(available).forEach(([field, set]) => {
            const value = flag[field];
            if (Array.isArray(value)) {
                value.forEach((item) => set.add(item));
            } else if (value) {
                set.add(value);
            }
        });
    });

    FILTER_GROUPS.forEach((group) => {
        document.querySelectorAll(`.filter-btn[data-${group.key}]`).forEach((button) => {
            const value = button.dataset[group.key];
            const active = state.filters[group.key].has(value);

            // Grey out a value no visible flag carries, since adding it would
            // leave nothing. An active value is exempt: the results already
            // reflect it, so a zero-match search would otherwise disable the
            // one button the user needs to click to remove it.
            const disabled = !active && !available[group.field].has(value);

            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
            button.disabled = disabled;
            button.classList.toggle('disabled', disabled);
        });
    });
}

export function toggleFilter(key, value) {
    const values = state.filters[key];
    if (values.has(value)) {
        values.delete(value);
    } else {
        values.add(value);
    }
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
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    state.filters = createEmptyFilters();
    state.search = '';
    searchInput().value = '';
    applyFilters();
}
