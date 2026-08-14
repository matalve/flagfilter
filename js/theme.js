// Dark mode handling: applies the .dark-mode class on <html> so the inline
// <head> snippet and this module share one source of truth. Split out of
// script.js; see #143.
import { safeStorageGet, safeStorageSet } from './util.js';

// Dark mode functionality. The dark-mode class lives on <html> so the inline
// snippet in <head> can set it before first paint (see index.html); this
// function owns it from here on. The toggle icons follow the class via CSS
// (.dark-mode .dark-mode-toggle …), so toggling the class is the whole state
// change. See #143.
export function initDarkMode() {
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
