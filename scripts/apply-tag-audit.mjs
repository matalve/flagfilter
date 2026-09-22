#!/usr/bin/env node
// Applies the approved rows of a tag audit to flaginfo.json. See #174.
//
// The audit itself is done by an agent looking at every flag image; this script
// is the part that touches the data, and it is deliberately dull. The agent
// never edits flaginfo.json — it writes proposals, a human deletes the rows they
// disagree with, and what survives is applied here. So the diff to the data is
// mechanical and reviewable on its own, separately from the judgement calls.
//
// Approval by deletion needs a record of what was deleted, or the next audit
// proposes the same rows again. That is why proposals.original.tsv exists: it is
// the agent's output, never edited, and the difference between it and the
// reviewed file is exactly the set of rejections.
//
// Run: node scripts/apply-tag-audit.mjs [--dry-run]

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TAG_TERMS } from '../js/filter-config.js';

const FLAG_INFO_PATH = 'flaginfo.json';
const BASELINE_DIR = 'flag-baseline';
const AUDIT_DIR = 'tag-audit';
const ORIGINAL_PATH = path.join(AUDIT_DIR, 'proposals.original.tsv');
const REVIEWED_PATH = path.join(AUDIT_DIR, 'proposals.tsv');
const REJECTED_PATH = path.join(AUDIT_DIR, 'rejected.tsv');

// Tags the audit must never touch, whatever an image seems to show. These are
// classifications and traditions rather than things visible in the picture: a
// crescent is a shape, `islam` is an interpretation of it, and pan-Slavic
// membership is not decided by the colours — which is the whole reason #169
// filters on a curated tag instead of on the palette.
const PROTECTED_TAGS = new Set([
    'whitney_smith',
    'pan-african', 'pan-arab', 'pan-slavic', 'british', 'nordic',
    'christianity', 'islam', 'judaism', 'buddhism', 'hinduism', 'communism',
    'africa', 'asia', 'europe', 'northAmerica', 'oceania', 'southAmerica'
]);

const dryRun = process.argv.includes('--dry-run');
const failures = [];

function readRows(filePath) {
    if (!existsSync(filePath)) {
        failures.push(`${filePath} does not exist`);
        return [];
    }

    return readFileSync(filePath, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => line.trim() !== '' && !line.startsWith('#'))
        .map(({ line, lineNumber }) => {
            const [code, tag, action, confidence, justification] = line.split('\t');
            return { code, tag, action, confidence, justification, lineNumber, key: `${code}\t${tag}\t${action}` };
        });
}

// A rejection is an answer about a particular picture. When flagcdn changes a
// flag the picture is a different one, so the answer no longer binds and the
// tag may be proposed again. #175 keeps flag-baseline/ in step with upstream,
// which makes its hash the right thing to stamp a rejection with.
function baselineHash(code) {
    const imagePath = path.join(BASELINE_DIR, `${code}.png`);
    if (!existsSync(imagePath)) return 'no-baseline';
    return createHash('sha256').update(readFileSync(imagePath)).digest('hex').slice(0, 16);
}

// The vocabulary is js/filter-config.js — the same list the buttons in
// index.html are held equal to. A tag outside it filters nothing, so proposing
// one is a bug rather than a finding.
const filterTerms = TAG_TERMS;
const flags = JSON.parse(readFileSync(FLAG_INFO_PATH, 'utf8'));
const flagsByCode = new Map(flags.map((flag) => [flag.shortname, flag]));

const original = readRows(ORIGINAL_PATH);
const reviewed = readRows(REVIEWED_PATH);

if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL: ${failure}`));
    process.exit(1);
}

const reviewedKeys = new Set(reviewed.map((row) => row.key));
const originalKeys = new Set(original.map((row) => row.key));

const rejected = original.filter((row) => !reviewedKeys.has(row.key));
const handAdded = reviewed.filter((row) => !originalKeys.has(row.key));

const previouslyRejected = new Map(
    (existsSync(REJECTED_PATH) ? readRows(REJECTED_PATH) : [])
        .map((row) => [row.key, row.confidence])
);

// Rerunning the script on a batch that has already been applied is not a mistake:
// the two proposals files still hold the same rows, so the same rejections are
// derived every time, and the run has to be a no-op. Append without checking and
// the ledger grows a duplicate set of every rejection per run, silently. A row
// whose stored hash is stale is the other case entirely — the image changed, the
// old rejection lapsed, and rejecting the proposal again earns a fresh line.
const unrecorded = rejected.filter((row) => previouslyRejected.get(row.key) !== baselineHash(row.code));
const alreadyRecorded = rejected.length - unrecorded.length;

reviewed.forEach((row) => {
    const where = `${REVIEWED_PATH}:${row.lineNumber}`;
    if (!flagsByCode.has(row.code)) {
        failures.push(`${where}: no flag with code "${row.code}"`);
        return;
    }
    if (!['add', 'remove'].includes(row.action)) {
        failures.push(`${where}: action must be add or remove, got "${row.action}"`);
    }
    if (!filterTerms.has(row.tag)) {
        failures.push(`${where}: "${row.tag}" is not a filter term in js/filter-config.js, so it would filter nothing`);
    }
    if (PROTECTED_TAGS.has(row.tag)) {
        failures.push(`${where}: "${row.tag}" is not decided by looking at the image and must not be audited`);
    }

    // A rejection stands until the flag's picture changes.
    const standing = previouslyRejected.get(row.key);
    if (standing && standing === baselineHash(row.code)) {
        failures.push(`${where}: this was rejected before and the image has not changed since — remove it from ${REJECTED_PATH} to reopen the question`);
    }
});

if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} problem(s) with the reviewed proposals:`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exit(1);
}

const applied = [];
const noop = [];

reviewed.forEach((row) => {
    const flag = flagsByCode.get(row.code);
    const words = flag.tags;
    const has = words.includes(row.tag);

    if (row.action === 'add' && has) {
        noop.push(`${row.code} already has ${row.tag}`);
        return;
    }
    if (row.action === 'remove' && !has) {
        noop.push(`${row.code} does not have ${row.tag}`);
        return;
    }

    // Search aliases live in their own field ("burma", "usa", "great britain")
    // and nothing here can reach them; tags is vocabulary only. See #203.
    flag.tags = row.action === 'add'
        ? [...words, row.tag]
        : words.filter((word) => word !== row.tag);

    applied.push(`${row.action === 'add' ? '+' : '-'} ${row.code} ${row.tag}`);
});

if (dryRun) {
    console.log('DRY RUN: nothing written.');
} else {
    writeFileSync(FLAG_INFO_PATH, `${JSON.stringify(flags, null, 2)}\n`);

    if (unrecorded.length > 0) {
        const header = existsSync(REJECTED_PATH)
            ? ''
            : '# Proposals a human declined, so later audits stay quiet about them.\n' +
              '# Columns: code, tag, action, baseline image hash at the time, justification.\n' +
              '# The code column is ISO 3166-1 alpha-2; look one up at\n' +
              '# https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes\n' +
              '# The hash expires the rejection: when flagcdn changes the flag, the question\n' +
              '# was answered about a different picture and may be asked again. Delete a line\n' +
              '# to reopen a question early. See #174.\n';
        appendFileSync(REJECTED_PATH, header + unrecorded
            .map((row) => [row.code, row.tag, row.action, baselineHash(row.code), row.justification].join('\t'))
            .join('\n') + '\n');
    }
}

console.log(`${applied.length} change(s) applied to ${FLAG_INFO_PATH}:`);
applied.forEach((change) => console.log(`  ${change}`));

if (unrecorded.length > 0) {
    console.log(`\n${unrecorded.length} proposal(s) declined and recorded in ${REJECTED_PATH}:`);
    unrecorded.forEach((row) => console.log(`  ${row.code} ${row.tag}`));
}

if (alreadyRecorded > 0) {
    console.log(`\n${alreadyRecorded} declined proposal(s) were already in ${REJECTED_PATH}; not written again.`);
}

if (handAdded.length > 0) {
    console.log(`\n${handAdded.length} row(s) were added by hand after the audit ran:`);
    handAdded.forEach((row) => console.log(`  ${row.code} ${row.tag} ${row.action}`));
}

if (noop.length > 0) {
    console.log(`\n${noop.length} row(s) changed nothing:`);
    noop.forEach((message) => console.log(`  ${message}`));
}
