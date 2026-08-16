#!/usr/bin/env node
// Refreshes flag-baseline/ from flagcdn and reports what moved.
//
// The site renders flag images from flagcdn at runtime and never re-reads them,
// so when a country changes its flag the picture changes under us while the
// tags, colours, symbolism and fun facts keep describing the old one. Nothing
// breaks; the site is simply, quietly wrong about the one subject it exists to
// be right about. This is the watchdog for that. See #175.
//
// The baseline images are detection data, not assets: 40px wide, never
// referenced by the page. Storing them rather than a table of checksums is what
// makes the alert readable — the change arrives as a PR whose diff is the
// picture, side by side, which is a two-second judgement instead of a paragraph
// to interpret.
//
// Run: node scripts/sync-flag-images.mjs [--body-out=<path>] [--pack=<zip>]
//
// --pack points at an already-downloaded archive instead of fetching one, which
// is how the comparison logic gets exercised somewhere flagcdn is unreachable.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PACK_URL = 'https://flagcdn.com/w40.zip';
const FLAG_INFO_PATH = 'flaginfo.json';
const BASELINE_DIR = 'flag-baseline';
const UPSTREAM_ONLY_PATH = path.join(BASELINE_DIR, 'upstream-only.txt');
// A handful of flags changing in one week is news. Dozens is not news, it is
// flagcdn re-encoding its pack or changing its layout, and opening a PR that
// touches every flag would bury the real thing next time.
const SUSPICIOUS_CHANGE_COUNT = 10;
// The pack should hold every country plus subdivisions; far fewer means the
// archive is not shaped the way this script assumes.
const MINIMUM_EXPECTED_UPSTREAM = 200;

function fail(message) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
}

function requireUnzip() {
    try {
        execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    } catch (error) {
        fail('unzip is not available; this script shells out to it to unpack the flag pack');
    }
}

async function downloadPack(destination) {
    let response;
    try {
        response = await fetch(PACK_URL);
    } catch (error) {
        // A watchdog that fails quietly is worse than no watchdog, so every
        // failure path here is loud and non-zero.
        fail(`could not reach ${PACK_URL}: ${error.message}`);
    }

    if (!response.ok) {
        fail(`${PACK_URL} responded ${response.status}`);
    }

    writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

// The pack's internal layout is not contractual — it may be flat or nested in a
// w40/ directory — so find the images rather than assuming where they are.
function collectUpstreamImages(root) {
    const images = new Map();

    const walk = (directory) => {
        readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(entryPath);
                return;
            }
            const match = entry.name.match(/^([a-z]{2}(?:-[a-z]{3})?)\.png$/);
            if (match) {
                images.set(match[1], entryPath);
            }
        });
    };

    walk(root);
    return images;
}

function sha256(filePath) {
    return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function formatFlagList(entries, namesByCode) {
    return entries
        .map((code) => `- \`${code}\` — ${namesByCode.get(code) || 'not in flaginfo.json'}`)
        .join('\n');
}

function buildBody({ changed, addedUpstream, missingUpstream, namesByCode }) {
    const sections = [];

    if (changed.length > 0) {
        sections.push(
            `## Changed images (${changed.length})\n\n${formatFlagList(changed, namesByCode)}\n\n` +
            'The diff above shows each one before and after. A changed flag invalidates more than the picture — for every flag listed, re-check:\n\n' +
            '- [ ] colour tags, and any pattern, symbol or motive tag describing the old design\n' +
            '- [ ] `symbolism` and `funfacts` in `flaginfo.json` **and** every `i18n/flags/*.json` overlay\n' +
            '- [ ] `adopted`, which is now a different date\n' +
            '- [ ] membership in the flag family filters\n\n' +
            'The tag audit in #174 is the thorough version of that first box.'
        );
    }

    if (addedUpstream.length > 0) {
        sections.push(
            `## New upstream (${addedUpstream.length})\n\n${formatFlagList(addedUpstream, namesByCode)}\n\n` +
            'flagcdn carries these and `flaginfo.json` does not. Each is a flag the site cannot show.'
        );
    }

    if (missingUpstream.length > 0) {
        sections.push(
            `## Missing upstream (${missingUpstream.length})\n\n${formatFlagList(missingUpstream, namesByCode)}\n\n` +
            'The site carries these and flagcdn no longer does, so the grid is requesting images that will not resolve.'
        );
    }

    return `${sections.join('\n\n')}\n\nMerging accepts the new baseline. Opened by \`scripts/sync-flag-images.mjs\`; see #175.\n`;
}

const bodyOutArgument = process.argv.find((argument) => argument.startsWith('--body-out='));
const bodyOutPath = bodyOutArgument ? bodyOutArgument.slice('--body-out='.length) : null;
const packArgument = process.argv.find((argument) => argument.startsWith('--pack='));
const localPackPath = packArgument ? packArgument.slice('--pack='.length) : null;

requireUnzip();

const flags = JSON.parse(readFileSync(FLAG_INFO_PATH, 'utf8'));
const namesByCode = new Map(flags.map((flag) => [flag.shortname, flag.name]));
const carriedCodes = [...namesByCode.keys()].sort();

const workDir = mkdtempSync(path.join(tmpdir(), 'flag-pack-'));
const packPath = path.join(workDir, 'pack.zip');
const unpackedDir = path.join(workDir, 'unpacked');

try {
    if (localPackPath) {
        console.log(`NOTE: using ${localPackPath} instead of downloading ${PACK_URL}`);
    } else {
        await downloadPack(packPath);
    }

    mkdirSync(unpackedDir);
    execFileSync('unzip', ['-q', '-o', localPackPath || packPath, '-d', unpackedDir]);

    const upstream = collectUpstreamImages(unpackedDir);
    if (upstream.size < MINIMUM_EXPECTED_UPSTREAM) {
        fail(`only ${upstream.size} images found in the pack — its layout is not what this script expects, so nothing was written`);
    }

    mkdirSync(BASELINE_DIR, { recursive: true });
    const seeding = readdirSync(BASELINE_DIR).filter((name) => name.endsWith('.png')).length === 0;

    const changed = [];
    const missingUpstream = [];

    carriedCodes.forEach((code) => {
        const upstreamPath = upstream.get(code);
        if (!upstreamPath) {
            missingUpstream.push(code);
            return;
        }

        const baselinePath = path.join(BASELINE_DIR, `${code}.png`);
        if (existsSync(baselinePath) && sha256(baselinePath) === sha256(upstreamPath)) {
            return;
        }

        changed.push({ code, upstreamPath, baselinePath });
    });

    if (!seeding && changed.length > SUSPICIOUS_CHANGE_COUNT) {
        fail(
            `${changed.length} images differ, which is too many to be ${changed.length} countries changing their flag. ` +
            'Likely a re-encode or a layout change upstream. Nothing was written — check the pack by hand.'
        );
    }

    changed.forEach(({ upstreamPath, baselinePath }) => {
        writeFileSync(baselinePath, readFileSync(upstreamPath));
    });

    // Codes upstream has that the site does not. Kept as a file so that a newly
    // added flag shows up as a diff exactly once, instead of being re-reported
    // every week until someone acts on it.
    const addedUpstream = [...upstream.keys()].filter((code) => !namesByCode.has(code)).sort();
    writeFileSync(UPSTREAM_ONLY_PATH, `${addedUpstream.join('\n')}\n`);

    const changedCodes = changed.map(({ code }) => code);

    if (seeding) {
        console.log(`OK: seeded ${changedCodes.length} baseline images from ${PACK_URL}.`);
    } else if (changedCodes.length === 0) {
        console.log(`OK: ${carriedCodes.length} flags checked, none changed.`);
    } else {
        console.log(`CHANGED: ${changedCodes.length} of ${carriedCodes.length} flags differ: ${changedCodes.join(', ')}`);
    }

    if (missingUpstream.length > 0) {
        console.log(`NOTE: ${missingUpstream.length} carried flag(s) are not in the pack: ${missingUpstream.join(', ')}`);
    }

    if (bodyOutPath) {
        writeFileSync(bodyOutPath, seeding
            ? `Seeds \`${BASELINE_DIR}/\` with ${changedCodes.length} images from \`${PACK_URL}\`.\n\n` +
              'Nothing to review flag by flag here — this is the starting point every later diff is measured against. See #175.\n'
            : buildBody({ changed: changedCodes, addedUpstream, missingUpstream, namesByCode }));
    }
} finally {
    rmSync(workDir, { recursive: true, force: true });
}
