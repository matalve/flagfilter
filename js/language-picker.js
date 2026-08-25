// The language control. A native <select> cannot render a picture in an option
// and the options here are flags, so this is a button plus a menu built by hand.
// The menu lists every language except the one being read: the button already
// shows that one, and repeating it gives the reader nothing to choose. See #194.
import { state } from './state.js';
import { LANGUAGE_FLAGS, LANGUAGE_NAMES, SUPPORTED_LANGUAGES, switchLanguage } from './i18n.js';
import { t } from './translate.js';

// flagcdn's h-endpoints ask for a height and let the width follow the flag's own
// proportion, so nothing is squashed. Asking for a fixed box instead is what
// bent the Union Jack's diagonals.
function flagMarkup(language) {
    const code = LANGUAGE_FLAGS[language];
    return `<img class="language-flag" src="https://flagcdn.com/h20/${code}.webp"`
        + ` srcset="https://flagcdn.com/h40/${code}.webp 2x" alt="" decoding="async">`;
}

function getElements() {
    return {
        picker: document.querySelector('.language-picker'),
        button: document.getElementById('languageButton'),
        menu: document.getElementById('languageMenu')
    };
}

function isOpen(menu) {
    return !menu.hasAttribute('hidden');
}

function closeMenu({ button, menu }, { focusButton = false } = {}) {
    if (!isOpen(menu)) {
        return;
    }
    menu.setAttribute('hidden', '');
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) {
        button.focus();
    }
}

function openMenu({ button, menu }, { focusFirst = false } = {}) {
    menu.removeAttribute('hidden');
    button.setAttribute('aria-expanded', 'true');
    if (focusFirst) {
        const first = menu.querySelector('.language-option');
        if (first) {
            first.focus();
        }
    }
}

// Called on init and after every switch: the button takes the new language's
// flag, and the menu is rebuilt from whatever is left.
export function renderLanguagePicker() {
    const { button, menu } = getElements();
    if (!button || !menu) {
        return;
    }

    button.innerHTML = flagMarkup(state.currentLanguage)
        + '<svg class="language-caret" aria-hidden="true"><use href="#i-chevron-down"></use></svg>';
    button.setAttribute('aria-label', t('language_picker_aria'));
    menu.setAttribute('aria-label', t('language_picker_aria'));

    // The name is the language's own — "Español" reads the same whatever the
    // interface language is — and it is the only text a screen reader gets,
    // since the option itself is a picture.
    menu.innerHTML = SUPPORTED_LANGUAGES
        .filter((language) => language !== state.currentLanguage)
        .map((language) => `<button type="button" role="menuitem" class="language-option"`
            + ` data-language="${language}" aria-label="${LANGUAGE_NAMES[language]}"`
            + ` title="${LANGUAGE_NAMES[language]}">${flagMarkup(language)}</button>`)
        .join('');
}

function moveFocus(menu, delta) {
    const options = Array.from(menu.querySelectorAll('.language-option'));
    if (options.length === 0) {
        return;
    }
    const current = options.indexOf(document.activeElement);
    const next = (current + delta + options.length) % options.length;
    options[next].focus();
}

export function initLanguagePicker() {
    const elements = getElements();
    const { picker, button, menu } = elements;
    if (!picker || !button || !menu) {
        return;
    }

    renderLanguagePicker();

    button.addEventListener('click', () => {
        if (isOpen(menu)) {
            closeMenu(elements);
        } else {
            openMenu(elements);
        }
    });

    button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(elements, { focusFirst: true });
        }
    });

    menu.addEventListener('click', async (event) => {
        const option = event.target.closest('.language-option');
        if (!option) {
            return;
        }
        closeMenu(elements, { focusButton: true });
        await switchLanguage(option.dataset.language);
        renderLanguagePicker();
    });

    menu.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocus(menu, 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocus(menu, -1);
        } else if (event.key === 'Escape') {
            closeMenu(elements, { focusButton: true });
        } else if (event.key === 'Tab') {
            closeMenu(elements);
        }
    });

    // A menu that stays open after the reader has moved on is a menu in the way.
    document.addEventListener('click', (event) => {
        if (!picker.contains(event.target)) {
            closeMenu(elements);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen(menu)) {
            closeMenu(elements, { focusButton: true });
        }
    });
}
