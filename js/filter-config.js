// The filter vocabulary and how each group combines, in one place. Everything
// that needs to know "which filter groups exist" — click binding, applyFilters,
// the greyed-out state, ?q= parsing, label translation, the Node validators —
// reads this instead of carrying its own copy. #182 was one of those copies
// drifting. The buttons themselves stay in index.html; a Playwright test holds
// the two equal. See #201.
//
// This module imports nothing, so scripts/*.mjs can import it under Node.
//
// key:     the data-* attribute on the buttons, the ?q= token kind, and the
//          i18n key prefix (`${key}_${value}`).
// field:   which flag property the value is looked up in.
// combine: 'all' — a flag must carry every active value (colours: red AND blue).
//          'any' — a flag must carry at least one (continents: Africa OR Asia).
// heading: i18n key of the group's <h3>, absent for colour, which is a section.
export const FILTER_GROUPS = [
    {
        key: 'color',
        field: 'colors',
        combine: 'all',
        values: ['red', 'blue', 'green', 'yellow', 'white', 'black', 'brown', 'purple', 'orange']
    },
    {
        key: 'continent',
        field: 'continent',
        combine: 'any',
        heading: 'continent',
        values: ['africa', 'asia', 'europe', 'northAmerica', 'southAmerica', 'oceania']
    },
    {
        key: 'pattern',
        field: 'tags',
        combine: 'any',
        heading: 'pattern',
        values: ['cross', 'vertical', 'horizontal', 'triangle', 'diagonal', 'whitney_smith']
    },
    {
        key: 'symbol',
        field: 'tags',
        combine: 'any',
        heading: 'symbol',
        values: ['flag', 'sun', 'star', 'moon', 'circle', 'fleur-de-lis', 'waves']
    },
    {
        key: 'motive',
        field: 'tags',
        combine: 'any',
        heading: 'motive',
        values: ['building', 'weapon', 'map', 'tool', 'boat', 'animal', 'bird', 'vegetation', 'mountain', 'shield']
    },
    {
        key: 'people',
        field: 'tags',
        combine: 'any',
        heading: 'people_or_clothing',
        values: ['face', 'crown', 'human', 'hat', 'hand']
    },
    {
        key: 'ideology',
        field: 'tags',
        combine: 'any',
        heading: 'ideology',
        values: ['christianity', 'islam', 'communism', 'buddhism', 'hinduism', 'judaism']
    },
    {
        key: 'text',
        field: 'tags',
        combine: 'any',
        heading: 'text',
        values: ['text', 'motto', 'name', 'ribbon']
    },
    {
        key: 'family',
        field: 'tags',
        combine: 'any',
        heading: 'flag_family',
        values: ['pan-african', 'pan-arab', 'pan-slavic', 'british', 'nordic']
    }
];

export const FILTER_KEYS = FILTER_GROUPS.map((group) => group.key);

export const COLOR_VALUES = FILTER_GROUPS.find((group) => group.key === 'color').values;

// Every value that has a button, across all groups.
export const FILTER_TERMS = new Set(FILTER_GROUPS.flatMap((group) => group.values));

// Does this flag carry this value, for this group? Continent is a single
// string; colours and tags are arrays.
export function flagHasValue(flag, group, value) {
    const field = flag[group.field];
    return Array.isArray(field) ? field.includes(value) : field === value;
}
