// UI string lookup, kept apart from the language switching in i18n.js.
//
// Almost every module needs t(), including the ones i18n.js has to call when
// the language changes (flags, filters). Leaving t() in i18n.js made those
// imports circular: i18n → flags → i18n. ES modules tolerate a cycle only for
// as long as nothing dereferences an imported binding while the modules are
// still evaluating, so the first module-level `const X = t(...)` anyone writes
// would break the whole app at load with a TDZ error. This module imports
// nothing but state and a pure helper, so it can sit at the bottom of the
// graph and the cycle disappears. See #143.
import { state } from './state.js';
import { hasTextValue } from './util.js';

export function t(key, vars = {}) {
    const template = hasTextValue(state.uiTranslations[key])
        ? state.uiTranslations[key]
        : (hasTextValue(state.fallbackUiTranslations[key]) ? state.fallbackUiTranslations[key] : key);
    return template.replace(/\{(\w+)\}/g, (_, varName) => vars[varName] ?? `{${varName}}`);
}
