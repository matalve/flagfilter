// Shared mutable app state. ES module imports are read-only bindings, so the
// state lives in a single exported object that modules mutate through
// (state.flags = ..., state.currentLanguage = ...). Split out of script.js;
// see #143.
import { FILTER_GROUPS } from './filter-config.js';

export const state = {
    flags: [],
    filteredFlags: [],
    // The active filter values per group, and the search text. The buttons and
    // the search box are rendered from these; see renderFilterButtons and
    // setStateFromQuery in filters.js. See #202.
    filters: Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, new Set()])),
    search: '',
    baseFlagInfo: [],
    // #142: Map lookups instead of O(flags) array scans in hot paths.
    flagsByCode: new Map(),
    flagCardsByCode: new Map(),
    uiTranslations: {},
    fallbackUiTranslations: {},
    flagTranslations: {},
    currentLanguage: 'en'
};
