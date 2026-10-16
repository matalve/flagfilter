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
// Run from the repository root:
//   node scripts/tag-audit-baseline.mjs record <tranche>   when writing the batch
//   node scripts/tag-audit-baseline.mjs check              before applying it
// Recorded are the tranche's flags and every flag in the proposals files, since a
// batch can carry a row for a flag outside its tranche (a decision carried over, or a
// row the reviewer added by hand). record refuses when no proposed flag is in the
// tranche at all, which is what a wrong tranche number looks like.
//
// check exits 1 and lists each flag whose baseline changed, each flag that joined or
// left the tranche, and each proposed flag that was never recorded.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RECORD_PATH = path.join('tag-audit', 'batch-baseline.tsv');
const TRANCHES_PATH = path.join('tag-audit', 'tranches.tsv');
const PROPOSAL_PATHS = [path.join('tag-audit', 'proposals.original.tsv'), path.join('tag-audit', 'proposals.tsv')];

const [mode, trancheArgument] = process.argv.slice(2);

function trancheCodes(tranche) {
    return readFileSync(TRANCHES_PATH, 'utf8')
        .split('\n')
        .filter((line) => line.trim() !== '' && !line.startsWith('#'))
        .map((line) => line.split('\t'))
        .filter((columns) => columns[2] === String(tranche))
        .map((columns) => columns[1])
        .sort();
}

// Rows lead with the flag's name, then its code.
function proposedCodes() {
    const codes = new Set();
    for (const file of PROPOSAL_PATHS) {
        if (!existsSync(file)) continue;
        readFileSync(file, 'utf8')
            .split('\n')
            .filter((line) => line.trim() !== '' && !line.startsWith('#'))
            .forEach((line) => codes.add(line.split('\t')[1]));
    }
    return codes;
}

function baselineHash(code) {
    const imagePath = path.join('flag-baseline', `${code}.png`);
    if (!existsSync(imagePath)) return 'no-baseline';
    return createHash('sha256').update(readFileSync(imagePath)).digest('hex').slice(0, 16);
}

if (mode === 'record' && /^[1-8]$/.test(trancheArgument || '')) {
    const inTranche = trancheCodes(trancheArgument);
    const proposed = proposedCodes();
    if (proposed.size > 0 && ![...proposed].some((code) => inTranche.includes(code))) {
        console.error(`FAIL: none of the ${proposed.size} proposed flags is in tranche ${trancheArgument}. Is that the right tranche number?`);
        process.exit(1);
    }
    const outside = [...proposed].filter((code) => !inTranche.includes(code)).sort();
    const rows = [
        ...inTranche.map((code) => `${code}\t${baselineHash(code)}\ttranche`),
        ...outside.map((code) => `${code}\t${baselineHash(code)}\tproposal`)
    ];
    const lines = [
        '# The flag-baseline/ picture each flag of the current tag audit batch was reviewed',
        '# against, written when the batch was proposed. Checked before applying by',
        '# scripts/tag-audit-baseline.mjs check. See tag-audit/README.md.',
        `# Tranche: ${trancheArgument}`,
        '# Columns: code, baseline image hash, why it is recorded (in the tranche, or proposed',
        '# from outside it).',
        ...rows
    ];
    writeFileSync(RECORD_PATH, `${lines.join('\n')}\n`);
    console.log(`Recorded ${inTranche.length} flags of tranche ${trancheArgument} in ${RECORD_PATH}.`);
    if (outside.length > 0) console.log(`Also recorded, proposed from outside the tranche: ${outside.join(' ')}`);
} else if (mode === 'check') {
    if (!existsSync(RECORD_PATH)) {
        console.error(`FAIL: ${RECORD_PATH} does not exist; record it when writing the batch.`);
        process.exit(1);
    }
    const text = readFileSync(RECORD_PATH, 'utf8');
    const tranche = (text.match(/^# Tranche: ([1-8])$/m) || [])[1];
    if (!tranche) {
        console.error(`FAIL: ${RECORD_PATH} names no tranche.`);
        process.exit(1);
    }
    const recorded = new Map(text
        .split('\n')
        .filter((line) => line.trim() !== '' && !line.startsWith('#'))
        .map((line) => {
            const [code, hash, reason] = line.split('\t');
            return [code, { hash, reason }];
        }));
    const current = trancheCodes(tranche);
    const proposed = proposedCodes();

    const problems = [];
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
    console.log(`OK: all ${current.length} flags of tranche ${tranche} still have the picture they were reviewed against.`);
} else {
    console.error('Usage: node scripts/tag-audit-baseline.mjs record <1-8> | check');
    process.exit(1);
}
