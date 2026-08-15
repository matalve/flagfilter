#!/usr/bin/env node
// Validates the ?q= cross-links inside flag prose — the <a href="?q=…"> links in
// symbolism and funfacts, both in flaginfo.json and in every i18n/flags/*.json
// overlay.
//
// Why this needs checking at all: a link that resolves to nothing does not throw
// and does not render broken. processHtmlContent() in js/modal.js drops the
// anchor and keeps the text, so a typo turns a cross-link into ordinary prose
// that nobody notices — in the modal it simply looks like a sentence. See #141.
//
// Run: node scripts/validate-flag-links.mjs

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const FLAG_INFO_PATH = process.argv[2] || 'flaginfo.json';
const FLAG_I18N_DIR = process.argv[3] || 'i18n/flags';
const INDEX_HTML_PATH = process.argv[4] || 'index.html';

// Link targets that are known to resolve to nothing and are waiting on the
// content pass in #167. They render as plain text today, so nothing is
// visibly broken — but they are not accepted silently either: an entry that
// stops matching anything is itself an error, so this list cannot quietly rot
// into a lie about the content.
const KNOWN_UNRESOLVED = [
    'pan-african',
    'pan-arab',
    'pan-slavic',
    'british',
    'nordic',
    'nordic+cross',
    // These three have an obvious target and only need the content edit:
    // communism (a filter), and the flags st and ci.
    'communist',
    'sao+tome+principe',
    'ivory+coast'
];

const TEXT_FIELDS = ['symbolism', 'funfacts'];
// Mirrors the a[href^="?q="] selector the runtime uses.
const LINK_PATTERN = /<a href="\?q=([^"]+)"/g;
// The filter kinds ?q= understands, kept in step with QUERY_FILTER_DATA_KEYS in
// js/filters.js.
const FILTER_DATA_KEYS = ['color', 'continent', 'pattern', 'symbol', 'motive', 'people', 'ideology', 'text'];

// Byte-for-byte the normalization in processHtmlContent(); the whole point of
// this script is to answer "would the runtime resolve this?", so any drift here
// makes the answer wrong.
function normalizeForQuery(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/&/g, ' and ')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '+');
}

function readJson(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`FAIL: ${filePath} is not valid JSON: ${error.message}`);
        process.exit(1);
    }
}

function collectLinks(text) {
    const targets = [];
    let match;
    LINK_PATTERN.lastIndex = 0;
    while ((match = LINK_PATTERN.exec(text)) !== null) {
        targets.push(match[1]);
    }
    return targets;
}

// The filter buttons in index.html are what ?q= actually resolves against at
// runtime, so they are the source of truth rather than a list duplicated here.
function readFilterTerms(htmlPath) {
    const html = readFileSync(htmlPath, 'utf8');
    const pattern = new RegExp(`data-(?:${FILTER_DATA_KEYS.join('|')})="([^"]+)"`, 'g');
    return new Set(Array.from(html.matchAll(pattern), (match) => match[1].toLowerCase()));
}

// Cheap edit distance, only ever run on the handful of targets that failed.
function editDistance(a, b) {
    const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j += 1) {
        rows[0][j] = j;
    }
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            rows[i][j] = Math.min(
                rows[i - 1][j] + 1,
                rows[i][j - 1] + 1,
                rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return rows[a.length][b.length];
}

function suggest(target, candidates) {
    const normalized = normalizeForQuery(target);
    let best = null;
    let bestDistance = Infinity;
    candidates.forEach((candidate) => {
        const distance = editDistance(normalized, candidate);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    });
    // Only offer a suggestion close enough to be plausible. Kept tight on
    // purpose: at a third of the length, "pan+arab" helpfully suggests "panama".
    return bestDistance <= Math.max(2, Math.round(normalized.length / 4)) ? best : null;
}

const flags = readJson(FLAG_INFO_PATH);
if (!Array.isArray(flags)) {
    console.error(`FAIL: ${FLAG_INFO_PATH} top-level value must be an array`);
    process.exit(1);
}

// Links resolve against the English source names and the flag codes, whatever
// language the prose is in — the runtime looks them up in baseFlagInfo, not in
// the translated flags. A "translated" link target is therefore a broken one.
const flagNames = new Set(flags.map((flag) => normalizeForQuery(flag.name || '')));
const flagCodes = new Set(flags.map((flag) => (flag.shortname || '').toLowerCase()));
const filterTerms = readFilterTerms(INDEX_HTML_PATH);
const suggestionPool = [...flagNames, ...flagCodes, ...filterTerms];

const sources = [];

flags.forEach((flag) => {
    TEXT_FIELDS.forEach((field) => {
        collectLinks(flag[field] || '').forEach((target) => {
            sources.push({ file: FLAG_INFO_PATH, where: `${flag.shortname}.${field}`, target });
        });
    });
});

readdirSync(FLAG_I18N_DIR)
    .filter((name) => name.endsWith('.json'))
    .forEach((name) => {
        const filePath = path.join(FLAG_I18N_DIR, name);
        const translations = readJson(filePath);
        Object.entries(translations).forEach(([key, value]) => {
            if (typeof value !== 'string') {
                return;
            }
            if (!TEXT_FIELDS.some((field) => key.endsWith(`_${field}`))) {
                return;
            }
            collectLinks(value).forEach((target) => {
                sources.push({ file: filePath, where: key, target });
            });
        });
    });

const broken = [];
const filterLinks = [];
const known = [];
const knownSet = new Set(KNOWN_UNRESOLVED);
const matchedKnown = new Set();

sources.forEach((link) => {
    const normalized = normalizeForQuery(link.target);
    if (flagNames.has(normalized) || flagCodes.has(link.target.toLowerCase())) {
        return;
    }
    if (filterTerms.has(link.target.toLowerCase())) {
        filterLinks.push(link);
        return;
    }
    if (knownSet.has(link.target)) {
        matchedKnown.add(link.target);
        known.push(link);
        return;
    }
    broken.push(link);
});

// An allowlist that outlives the problem it describes is worse than none: it
// silently blesses whatever drifts into it later.
const staleKnown = KNOWN_UNRESOLVED.filter((target) => !matchedKnown.has(target));

if (filterLinks.length > 0) {
    const distinct = [...new Set(filterLinks.map((link) => link.target))].sort();
    console.log(`NOTE: ${filterLinks.length} link(s) point at filter terms rather than flags: ${distinct.join(', ')}`);
    console.log('      These stay real ?q= links and apply the filter when followed.');
}

if (known.length > 0) {
    const distinct = [...matchedKnown].sort();
    console.log(`NOTE: ${known.length} known-unresolved link(s) awaiting a content pass: ${distinct.join(', ')}`);
}

const failures = [];

broken.forEach((link) => {
    const hint = suggest(link.target, suggestionPool);
    failures.push(`${link.file} ${link.where}: ?q=${link.target}${hint ? ` (did you mean "${hint}"?)` : ''}`);
});

staleKnown.forEach((target) => {
    failures.push(`KNOWN_UNRESOLVED lists "${target}", which no longer appears — remove it from the list`);
});

if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} problem(s) with flag links:`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exit(1);
}

console.log(`OK: ${sources.length} flag links checked; ${sources.length - known.length - filterLinks.length} resolve to a flag.`);
