// Shared mutable app state. ES module imports are read-only bindings, so the
// state lives in a single exported object that modules mutate through
// (state.flags = ..., state.currentLanguage = ...). Split out of script.js;
// see #143.
export const state = {
    flags: [],
    filteredFlags: [],
    baseFlagInfo: [],
    // #142: Map lookups instead of O(flags) array scans in hot paths.
    flagsByCode: new Map(),
    flagCardsByCode: new Map(),
    uiTranslations: {},
    fallbackUiTranslations: {},
    flagTranslations: {},
    currentLanguage: 'en'
};
