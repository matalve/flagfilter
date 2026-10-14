#!/usr/bin/env node
// Runs searches against a copy of the site and prints which flags each one finds.
// See tag-audit/README.md.
//
// An alias is only worth adding if the search finds the flag with it, and the search
// has its own rules: a filter word in the query becomes the filter, the rest is
// matched as a substring of names and aliases. So test the batch, applied, in a real
// browser rather than reasoning about it: copy the repository somewhere, run
// scripts/apply-tag-audit.mjs in the copy, then point this at the copy.
//
// Run: node scripts/tag-audit-search.mjs [--root <dir>] [--lang en|es] <query>...
// --root defaults to the current directory.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    const [value] = args.splice(index, 2).slice(1);
    return value;
};
const root = path.resolve(option('--root', '.'));
const lang = option('--lang', 'en');
const queries = args;

if (queries.length === 0) {
    console.error('Usage: node scripts/tag-audit-search.mjs [--root <dir>] [--lang en|es] <query>...');
    process.exit(1);
}

// Module scripts refuse to run unless served as JavaScript, so the type matters.
const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

const server = createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
        response.writeHead(403).end();
        return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!existsSync(filePath)) {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage();
try {
    for (const query of queries) {
        await page.goto(`http://127.0.0.1:${port}/?lang=${lang}&q=${encodeURIComponent(query)}`);
        await page.waitForSelector('.flag-card, .no-results', { timeout: 10000 });
        const found = await page.$$eval('.flag-card img', (imgs) => imgs.map((img) => img.src.match(/\/([a-z-]+)\.webp$/)?.[1]));
        console.log(`${JSON.stringify(query).padEnd(24)} ${found.length ? found.join(' ') : '(nothing)'}`);
    }
} finally {
    await browser.close();
    server.close();
}
