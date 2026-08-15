// Small pure helpers shared across modules. Split out of script.js; see #143.

// localStorage can throw on every access (private mode, blocked storage — notably
// Safari). Route all persistence through these helpers so a denied store degrades
// to "no persistence" instead of aborting initApp. See #146.
export function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

export function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        // Storage unavailable — the app keeps working without persistence.
    }
}

// Programmatic focus on a <select> leaves it "ghost-focused" on touch devices:
// the native picker stays closed and the first physical tap only clears the
// focus. Move focus automatically only on devices with a fine pointer
// (mouse/trackpad). See #146.
export function focusIfFinePointer(element) {
    if (element && window.matchMedia('(pointer: fine)').matches) {
        element.focus();
    }
}

// The modal body is its own scroll container and the report flow lives at the
// bottom of it, so anything revealed there — the form itself, and every status
// message — lands below the fold for a reader who has already scrolled down.
// 'nearest' scrolls the least amount needed and does nothing when the element
// is already visible.
export function revealInScrollParent(element) {
    element.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
}

export function hasTextValue(value) {
    return typeof value === 'string' && value.trim() !== '';
}

export function setButtonLabel(button, label) {
    const icon = button.querySelector('.icon');
    if (!icon) {
        button.textContent = label;
        return;
    }

    button.innerHTML = '';
    button.appendChild(icon);
    icon.setAttribute('aria-hidden', 'true');
    button.append(` ${label}`);
}

export function updateToggleButtonState(button) {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
}

export function updateAllToggleButtonStates() {
    document.querySelectorAll('.filter-btn').forEach(updateToggleButtonState);
}

export function normalizeQueryValue(value) {
    return String(value || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

export async function loadJson(path, fallbackValue = {}) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            return fallbackValue;
        }
        return await response.json();
    } catch (error) {
        console.warn(`Could not load ${path}:`, error);
        return fallbackValue;
    }
}

// flagcdn serves every w320 image at 320px wide; the height follows the flag's proportion.
export const FLAG_IMAGE_SOURCE_WIDTH = 320;
// The grid crops every flag to a uniform 3:2 box (see `.flag-card img` in styles.css),
// so reserve that ratio up front to avoid layout shift while images load.
export const FLAG_GRID_IMAGE_HEIGHT = Math.round(FLAG_IMAGE_SOURCE_WIDTH * 2 / 3);
// Eagerly load the first row(s) of above-the-fold flag images instead of lazily,
// so the LCP image (the first one) is not deferred behind the data fetch. See #108.
export const EAGER_FLAG_IMAGE_COUNT = 8;

// Derive intrinsic pixel dimensions from a "height:width" proportion (e.g. "5:8").
// Returns null for non-numeric proportions such as Nepal's "It's complicated.".
export function getFlagImageDimensions(proportion) {
    const match = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(String(proportion || ''));
    if (!match) {
        return null;
    }

    const heightUnits = Number(match[1]);
    const widthUnits = Number(match[2]);
    if (!heightUnits || !widthUnits) {
        return null;
    }

    return {
        width: FLAG_IMAGE_SOURCE_WIDTH,
        height: Math.round(FLAG_IMAGE_SOURCE_WIDTH * heightUnits / widthUnits)
    };
}

export function isEditableTarget(target) {
    if (!target) {
        return false;
    }

    const tagName = target.tagName?.toLowerCase();
    return tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || target.isContentEditable;
}
