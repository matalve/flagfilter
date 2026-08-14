// Flag data: fetching flaginfo.json, per-language rebuilds, grid rendering and
// the result counter. Split out of script.js; see #143.
import { state } from './state.js';
import {
    EAGER_FLAG_IMAGE_COUNT,
    FLAG_GRID_IMAGE_HEIGHT,
    FLAG_IMAGE_SOURCE_WIDTH,
    hasTextValue,
    normalizeQueryValue
} from './util.js';
import { t } from './i18n.js';

const flagGrid = document.getElementById('flagGrid');

export function getBaseFlagInfoByCode(code) {
    return state.baseFlagInfo.find((info) => info.shortname === code);
}

function localizeFlagInfo(info) {
    if (state.currentLanguage === 'en') {
        return { ...info };
    }

    const translatedInfo = { ...info };
    const translatableFields = ['name', 'symbolism', 'funfacts', 'adopted', 'proportion'];

    translatableFields.forEach((field) => {
        const key = `${info.shortname}_${field}`;
        if (hasTextValue(state.flagTranslations[key])) {
            translatedInfo[field] = state.flagTranslations[key];
        }
    });

    return translatedInfo;
}

export function rebuildFlags() {
    state.flags = state.baseFlagInfo.map((baseInfo) => {
        const info = localizeFlagInfo(baseInfo);
        const code = info.shortname;
        const url = `https://flagcdn.com/w320/${code}.webp`;
        const tags = info.tags || '';
        const colorTags = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'brown', 'purple', 'orange'];
        const colors = colorTags.filter(color => tags.includes(color));

        // Precompute one normalized search haystack per flag (localized name +
        // English base name + code + tags), so matchesSearchTerm becomes a single
        // includes() that folds diacritics and works regardless of UI language.
        // Each field is normalized separately and joined with a NUL sentinel that
        // the query normalization always strips, so a search term can never match
        // across a field boundary (e.g. "spain es"). See #144 and #151.
        const searchText = [info.name || '', baseInfo.name || '', code, tags]
            .map(normalizeQueryValue)
            .join(String.fromCharCode(0));

        return {
            code,
            url,
            continent: info.continent || null,
            name: info.name || code.toUpperCase(),
            colors,
            tags: tags.split(' '),
            info,
            searchText
        };
    });
    state.flagsByCode = new Map(state.flags.map((flag) => [flag.code, flag]));
    buildFlagCards();
}

// Fetch flag data from local source and apply translations
export async function fetchFlags() {
    try {
        const flagInfoResponse = await fetch('flaginfo.json');
        state.baseFlagInfo = await flagInfoResponse.json();
        rebuildFlags();

        // Don't render here: initApp resolves the initial ?q= filter first, so the
        // grid renders exactly once with the correct above-the-fold flags (and the
        // eager / high-priority LCP image lands on the right one). See PR #115.
        return state.flags;
    } catch (error) {
        console.error('Error fetching flag data:', error);
        flagGrid.innerHTML = `<p class="error">${t('error_loading_flags')}</p>`;
    }
}

// Create one persistent card element per flag. Cards are built once per language
// (names, alt texts and button labels are localized) and then reused across renders.
function createFlagCard(flag) {
    const flagCard = document.createElement('div');
    flagCard.className = 'flag-card';

    flagCard.innerHTML = `
        <img src="${flag.url}" alt="${t('flag_image_alt', { name: flag.name })}" width="${FLAG_IMAGE_SOURCE_WIDTH}" height="${FLAG_GRID_IMAGE_HEIGHT}" loading="lazy">
        <h3>${flag.name}</h3>
        <button class="learn-more-btn" data-code="${flag.code}" aria-haspopup="dialog">${t('learn_more')}</button>
    `;

    return flagCard;
}

function buildFlagCards() {
    state.flagCardsByCode = new Map(state.flags.map((flag) => [flag.code, createFlagCard(flag)]));
}

// Render the flag grid by reordering the persistent card nodes (appendChild moves
// an existing node instead of recreating it), so filtering no longer rebuilds
// ~250 cards per interaction. See #142.
export function renderFlagGrid() {
    if (state.filteredFlags.length === 0) {
        flagGrid.replaceChildren();
        const noResults = document.createElement('p');
        noResults.className = 'no-results';
        noResults.textContent = t('no_results');
        flagGrid.appendChild(noResults);
        updateFlagCounter(0);
        return;
    }

    const visibleCards = new Set();
    state.filteredFlags.forEach((flag, index) => {
        const flagCard = state.flagCardsByCode.get(flag.code);

        // Above-the-fold images load eagerly; the first one is the LCP candidate
        // and gets high fetch priority. Everything below the fold stays lazy.
        // These depend on the card's position, so refresh them on every render.
        const image = flagCard.querySelector('img');
        image.loading = index < EAGER_FLAG_IMAGE_COUNT ? 'eager' : 'lazy';
        if (index === 0) {
            image.setAttribute('fetchpriority', 'high');
        } else {
            image.removeAttribute('fetchpriority');
        }

        visibleCards.add(flagCard);
        flagGrid.appendChild(flagCard);
    });

    // Detach the cards that fell out of the result set.
    Array.from(flagGrid.children).forEach((child) => {
        if (!visibleCards.has(child)) {
            child.remove();
        }
    });

    updateFlagCounter(state.filteredFlags.length);
}

export function updateFlagCounter(count) {
    const counter = document.getElementById('flagCounter');
    counter.textContent = count === 1
        ? t('flag_counter_one', { count })
        : t('flag_counter_other', { count });
}
