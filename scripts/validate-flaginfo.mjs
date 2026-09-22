#!/usr/bin/env node
// Validates flaginfo.json: required fields, unique codes, continent coverage,
// and that every tag is a filter term.
// Run: node scripts/validate-flaginfo.mjs

import { readFileSync } from 'node:fs';
import { FILTER_GROUPS, TAG_TERMS } from '../js/filter-config.js';

const KNOWN_CONTINENTS = FILTER_GROUPS.find((group) => group.key === 'continent').values;
// Antarctic territories intentionally have no continent (there is no Antarctic filter).
const NO_CONTINENT = ['aq', 'bv', 'gs', 'hm', 'tf'];
const REQUIRED_STRING_FIELDS = ['shortname', 'name', 'proportion', 'adopted', 'symbolism', 'funfacts', 'wikipedialink'];

const path = process.argv[2] || 'flaginfo.json';

let flags;
try {
    flags = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
    console.error(`FAIL: ${path} is not valid JSON: ${error.message}`);
    process.exit(1);
}

const errors = [];

if (!Array.isArray(flags)) {
    console.error('FAIL: top-level value must be an array');
    process.exit(1);
}

const seenCodes = new Set();

flags.forEach((flag, index) => {
    const label = flag && flag.shortname ? flag.shortname : `entry #${index}`;

    if (!flag || typeof flag !== 'object' || Array.isArray(flag)) {
        errors.push(`${label}: entry is not an object`);
        return;
    }

    REQUIRED_STRING_FIELDS.forEach((field) => {
        if (typeof flag[field] !== 'string' || flag[field].trim() === '') {
            errors.push(`${label}: missing or empty required field "${field}"`);
        }
    });

    // tags is the filter vocabulary and nothing else: a word here that has no
    // button filters nothing. Search-only keywords go in aliases; the continent
    // has its own field and is not a tag either. See #203.
    if (!Array.isArray(flag.tags) || flag.tags.length === 0) {
        errors.push(`${label}: "tags" must be a non-empty array`);
    } else {
        flag.tags.forEach((tag) => {
            if (!TAG_TERMS.has(tag)) {
                errors.push(`${label}: tag "${tag}" is not a tag-backed filter term (js/filter-config.js); a search keyword belongs in "aliases", a continent in "continent"`);
            }
        });
        if (new Set(flag.tags).size !== flag.tags.length) {
            errors.push(`${label}: duplicate tags`);
        }
    }

    if (flag.aliases !== undefined) {
        const valid = Array.isArray(flag.aliases)
            && flag.aliases.length > 0
            && flag.aliases.every((alias) => typeof alias === 'string' && alias.trim() !== '');
        if (!valid) {
            errors.push(`${label}: "aliases" must be a non-empty array of strings when present`);
        }
    }

    if (flag.shortname) {
        if (seenCodes.has(flag.shortname)) {
            errors.push(`${label}: duplicate shortname`);
        }
        seenCodes.add(flag.shortname);
    }

    if (flag.continent === undefined) {
        if (!NO_CONTINENT.includes(flag.shortname)) {
            errors.push(`${label}: no continent (add one, or whitelist it in NO_CONTINENT)`);
        }
    } else if (!KNOWN_CONTINENTS.includes(flag.continent)) {
        errors.push(`${label}: unknown continent "${flag.continent}" (known: ${KNOWN_CONTINENTS.join(', ')})`);
    }
});

if (errors.length > 0) {
    console.error(`FAIL: ${errors.length} problem(s) in ${path}:`);
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
}

console.log(`OK: ${flags.length} flags in ${path} are valid.`);
