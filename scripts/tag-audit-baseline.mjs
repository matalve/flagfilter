#!/usr/bin/env node
// Records which picture of each flag a tag audit batch was reviewed against, and
// checks before applying that nothing has moved since. See tag-audit/README.md.
//
// A rejection is stamped with the hash of the flag's image in flag-baseline/, so a
// decision must be applied against the same picture it was made on. That picture is
// recorded here when the batch is proposed: tag-audit-look.mjs has just confirmed
// flagcdn serves exactly what flag-baseline/ holds. The check compares with the
// recording, not with git history, so rebasing the branch during review, any number
// of times, cannot hide a change.
//
// The batch names its tranche in the header of proposals.original.tsv
// ("# Tranche: 6", or "# Tranche: none" for a removal round). Recorded are that
// tranche's flags and every flag in the proposals files, since a batch can carry a row
// for a flag outside its tranche: a decision carried over, or a row the reviewer adds
// by hand. Such rows are few, so record requires more than half the proposed flags to
// be in the named tranche; anything less is what a wrong number looks like. A tie is
// refused too, since it cannot tell the right tranche from the carried-over one.
//
// record and check both refuse while flaginfo.json has a flag that tranches.tsv does
// not list: the frozen list cannot pick up a new flag by itself, and the batch that
// finds it adds it under its own number (or the next tranche's, if it arrives during
// review).
//
// Run from the repository root:
//   node scripts/tag-audit-baseline.mjs record   when writing the batch
//   node scripts/tag-audit-baseline.mjs check    before applying it
//   node scripts/tag-audit-baseline.mjs codes    prints every recorded flag, for the
//                                                final live check
// check exits 1 and lists each flag whose baseline changed, each flag that joined or
// left the tranche, and each proposed flag that was never recorded.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RECORD_PATH = path.join('tag-audit', 'batch-baseline.tsv');
const TRANCHES_PATH = path.join('tag-audit', 'tranches.tsv');
const FLAG_INFO_PATH = 'flaginfo.json';
const ORIGINAL_PATH = path.join('tag-audit', 'proposals.original.tsv');
const PROPOSAL_PATHS = [ORIGINAL_PATH, path.join('tag-audit', 'proposals.tsv')];

const fail = (message) => {
    console.error(`FAIL: ${message}`);
    process.exit(1);
};

const dataLines = (text) => text.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('#'));

const trancheMarker = (text) => (text.match(/^# Tranche: (\S+)\s*$/m) || [])[1];

function trancheCodes(tranche) {
    if (tranche === 'none') return [];
    return dataLines(readFileSync(TRANCHES_PATH, 'utf8'))
        .map((line) => line.split('\t'))
        .filter((columns) => columns[2] === tranche)
        .map((columns) => columns[1])
        .sort();
}

// Rows lead with the flag's name, then its code.
function proposedCodes() {
    const codes = new Set();
    for (const file of PROPOSAL_PATHS) {
        if (!existsSync(file)) continue;
        dataLines(readFileSync(file, 'utf8')).forEach((line) => codes.add(line.split('\t')[1]));
    }
    return codes;
}

function baselineHash(code) {
    const imagePath = path.join('flag-baseline', `${code}.png`);
    if (!existsSync(imagePath)) return 'no-baseline';
    return createHash('sha256').update(readFileSync(imagePath)).digest('hex').slice(0, 16);
}

function unlistedCodes() {
    const listed = new Set(dataLines(readFileSync(TRANCHES_PATH, 'utf8')).map((line) => line.split('\t')[1]));
    return JSON.parse(readFileSync(FLAG_INFO_PATH, 'utf8'))
        .map((flag) => flag.shortname)
        .filter((code) => !listed.has(code))
        .sort();
}

function readRecording() {
    if (!existsSync(RECORD_PATH)) fail(`${RECORD_PATH} does not exist; record it when writing the batch.`);
    const text = readFileSync(RECORD_PATH, 'utf8');
    const tranche = trancheMarker(text);
    if (!tranche) fail(`${RECORD_PATH} names no tranche.`);
    const recorded = new Map(dataLines(text).map((line) => {
        const [code, hash, reason] = line.split('\t');
        return [code, { hash, reason }];
    }));
    return { tranche, recorded };
}

const mode = process.argv[2];

if (mode === 'record') {
    if (!existsSync(ORIGINAL_PATH)) fail(`${ORIGINAL_PATH} does not exist; write the batch first.`);
    const tranche = trancheMarker(readFileSync(ORIGINAL_PATH, 'utf8'));
    if (!/^([1-8]|none)$/.test(tranche || '')) {
        fail(`${ORIGINAL_PATH} needs a "# Tranche: <1-8>" header line ("# Tranche: none" for a removal round).`);
    }
    const unlisted = unlistedCodes();
    if (unlisted.length > 0) {
        fail(`flaginfo.json has flags tranches.tsv does not list: ${unlisted.join(' ')}. Add them under this batch's tranche and audit them with it.`);
    }
    const inTranche = trancheCodes(tranche);
    const proposed = [...proposedCodes()];
    if (tranche !== 'none' && proposed.length > 0) {
        const inside = proposed.filter((code) => inTranche.includes(code)).length;
        if (inside * 2 <= proposed.length) {
            fail(`only ${inside} of the ${proposed.length} proposed flags are in tranche ${tranche}; more than half must be. Is the header's tranche number right? A carried-over row can wait for a larger batch.`);
        }
    }
    const outside = proposed.filter((code) => !inTranche.includes(code)).sort();
    const lines = [
        '# The flag-baseline/ picture each flag of the current tag audit batch was reviewed',
        '# against, written when the batch was proposed. Checked before applying by',
        '# scripts/tag-audit-baseline.mjs check. See tag-audit/README.md.',
        `# Tranche: ${tranche}`,
        '# Columns: code, baseline image hash, why it is recorded (in the tranche, or',
        '# proposed from outside it).',
        ...inTranche.map((code) => `${code}\t${baselineHash(code)}\ttranche`),
        ...outside.map((code) => `${code}\t${baselineHash(code)}\tproposal`)
    ];
    writeFileSync(RECORD_PATH, `${lines.join('\n')}\n`);
    console.log(`Recorded ${inTranche.length} flags of tranche ${tranche} in ${RECORD_PATH}.`);
    if (outside.length > 0) console.log(`Also recorded, proposed from outside the tranche: ${outside.join(' ')}`);
} else if (mode === 'check') {
    const { tranche, recorded } = readRecording();
    const current = trancheCodes(tranche);
    const proposed = proposedCodes();

    const problems = unlistedCodes().map((code) => `${code}: in flaginfo.json but not in tranches.tsv; list it under this tranche and look at it, or under the next`);
    for (const code of current) {
        if (!recorded.has(code)) problems.push(`${code}: joined tranche ${tranche} after the batch was proposed, and was never looked at`);
        else if (recorded.get(code).hash !== baselineHash(code)) problems.push(`${code}: its baseline image changed during review`);
    }
    for (const code of [...proposed].filter((c) => !current.includes(c)).sort()) {
        if (!recorded.has(code)) problems.push(`${code}: proposed, but outside tranche ${tranche} and never recorded`);
        else if (recorded.get(code).hash !== baselineHash(code)) problems.push(`${code}: its baseline image changed during review`);
    }
    for (const [code, { reason }] of recorded) {
        if (reason === 'tranche' && !current.includes(code)) problems.push(`${code}: left tranche ${tranche} after the batch was proposed`);
    }

    if (problems.length > 0) {
        console.error('FAIL: the batch was reviewed against pictures that have since moved:');
        problems.forEach((problem) => console.error(`  - ${problem}`));
        process.exit(1);
    }
    console.log(`OK: all ${recorded.size} recorded flags still have the picture they were reviewed against.`);
} else if (mode === 'codes') {
    const { recorded } = readRecording();
    console.log([...recorded.keys()].sort().join('\n'));
} else {
    fail('usage: node scripts/tag-audit-baseline.mjs record | check | codes');
}
