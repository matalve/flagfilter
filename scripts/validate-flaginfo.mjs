#!/usr/bin/env node
// Validates flaginfo.json: required fields, unique codes, and continent coverage.
// Run: node scripts/validate-flaginfo.mjs

import { readFileSync } from 'node:fs';

const KNOWN_CONTINENTS = ['africa', 'asia', 'europe', 'northAmerica', 'southAmerica', 'oceania'];
// Antarctic territories intentionally have no continent (there is no Antarctic filter).
const NO_CONTINENT = ['aq', 'bv', 'gs', 'hm', 'tf'];
const REQUIRED_STRING_FIELDS = ['tags', 'shortname', 'name', 'proportion', 'adopted', 'symbolism', 'funfacts', 'wikipedialink'];

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
