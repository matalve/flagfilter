#!/usr/bin/env node
// Fetches flag images for a tag audit tranche, writes contact sheets to look at,
// and prints how much of each flag is each filter colour. See tag-audit/README.md.
//
// The colour count is there because eyes are bad at it: a thin black outline, a
// white star on a light field or a dark red that reads as brown all get missed or
// invented. It counts pixels of the image as flagcdn serves it, composited on white,
// so a transparent background (Nepal's pennant) counts as white rather than black.
//
// Before anything else it checks that flagcdn still serves the picture recorded in
// flag-baseline/. A rejection is stamped with the baseline image's hash, so auditing a
// picture flagcdn has changed since would stamp the decision on the old image, and it
// would lapse the moment the image watch's pull request is merged. On a difference it
// stops: merge that pull request first.
//
// Run: node scripts/tag-audit-look.mjs --out <dir> [--size w320|w1280] <code>...
// Run it from the repository root. Needs network access to flagcdn.com and a
// Playwright browser, which is used here only to decode the PNGs.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    const [value] = args.splice(index, 2).slice(1);
    return value;
};
const outDir = option('--out');
const size = option('--size', 'w320');
const codes = args;

if (!outDir || codes.length === 0) {
    console.error('Usage: node scripts/tag-audit-look.mjs --out <dir> [--size w320|w1280] <code>...');
    process.exit(1);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const drifted = [];
for (const code of codes) {
    const baselinePath = path.join('flag-baseline', `${code}.png`);
    if (!existsSync(baselinePath)) {
        drifted.push(`${code}: no image in flag-baseline/`);
        continue;
    }
    const response = await fetch(`https://flagcdn.com/w40/${code}.png`);
    if (!response.ok) {
        drifted.push(`${code}: flagcdn answered ${response.status} for the w40 image`);
        continue;
    }
    if (sha256(Buffer.from(await response.arrayBuffer())) !== sha256(readFileSync(baselinePath))) {
        drifted.push(`${code}: flagcdn's image differs from flag-baseline/${code}.png`);
    }
}
if (drifted.length > 0) {
    console.error('FAIL: these flags are not the picture the baseline records:');
    drifted.forEach((line) => console.error(`  - ${line}`));
    console.error('Run or merge the image watch (scripts/sync-flag-images.mjs) before auditing them.');
    process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const images = [];
for (const code of codes) {
    const response = await fetch(`https://flagcdn.com/${size}/${code}.png`);
    if (!response.ok) {
        console.error(`FAIL: ${code}: flagcdn answered ${response.status}`);
        process.exit(1);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(path.join(outDir, `${code}.png`), bytes);
    images.push({ code, dataUrl: `data:image/png;base64,${bytes.toString('base64')}` });
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');

// Same buckets as the colour filters. Thresholds are on HSV; the brown band is the
// dark end of red and orange. Red runs down to 330 degrees. Measured over all 254
// flags (2026-10), flagcdn's dark reds sit at 340-345 (the US stripes are 344,
// Qatar's maroon 342), and nothing between 330 and 340 is a real colour: only 1-3%
// of anti-aliased pixels where red meets blue. At 330 that noise reads as red, on
// flags that already carry red; at 340 it would read as purple, which invites a
// wrong purple tag. Qatar counts as red here while carrying purple by choice (see
// #184): the count is evidence for a colour tag, not the decision.
const shares = await page.evaluate(async (list) => {
    const classify = (r, g, b) => {
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const v = max;
        const s = max === 0 ? 0 : (max - min) / max;
        let h = 0;
        if (max !== min) {
            const d = max - min;
            const [rr, gg, bb] = [r / 255, g / 255, b / 255];
            if (max === rr) h = ((gg - bb) / d) % 6;
            else if (max === gg) h = (bb - rr) / d + 2;
            else h = (rr - gg) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        if (v < 0.2) return 'black';
        if (s < 0.15) return v > 0.8 ? 'white' : 'grey';
        if (h >= 330 || h < 12) return 'red';
        if (h < 40) return v >= 0.6 ? 'orange' : 'brown';
        if (h < 70) return 'yellow';
        if (h < 170) return 'green';
        if (h < 260) return 'blue';
        return 'purple';
    };
    const canvas = document.getElementById('c');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const results = [];
    for (const { code, dataUrl } of list) {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        canvas.width = 160;
        canvas.height = Math.round((160 * image.naturalHeight) / image.naturalWidth);
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const counts = {};
        for (let i = 0; i < data.length; i += 4) {
            const bucket = classify(data[i], data[i + 1], data[i + 2]);
            counts[bucket] = (counts[bucket] || 0) + 1;
        }
        const total = data.length / 4;
        results.push({
            code,
            shares: Object.entries(counts)
                .map(([bucket, count]) => [bucket, (100 * count) / total])
                .filter(([, share]) => share >= 0.3)
                .sort((a, b) => b[1] - a[1])
        });
    }
    return results;
}, images);

for (const { code, shares: list } of shares) {
    console.log(`${code.padEnd(7)} ${list.map(([bucket, share]) => `${bucket}:${share.toFixed(1)}`).join('  ')}`);
}

// Contact sheets, eight flags each, labelled with the code. One look covers a
// quarter of a tranche, which is what the audit reviews by eye.
const perSheet = 8;
for (let start = 0, sheet = 1; start < images.length; start += perSheet, sheet += 1) {
    const cells = images.slice(start, start + perSheet).map(({ code, dataUrl }) => (
        `<figure><img src="${dataUrl}"><figcaption>${code}</figcaption></figure>`
    )).join('');
    await page.setContent(`<style>
        body { margin: 0; background: #fff; font: 16px sans-serif; }
        main { display: grid; grid-template-columns: repeat(4, 300px); gap: 12px; padding: 12px; }
        figure { margin: 0; text-align: center; }
        img { width: 300px; height: 200px; object-fit: contain; }
    </style><main>${cells}</main>`);
    const sheetPath = path.join(outDir, `sheet-${sheet}.png`);
    await page.locator('main').screenshot({ path: sheetPath });
    console.log(`wrote ${sheetPath}`);
}

await browser.close();
