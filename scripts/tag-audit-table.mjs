#!/usr/bin/env node
// Prints the rows of tag-audit/proposals.tsv as Markdown tables for the pull
// request, one for tags and one for aliases. Each row shows the flag's image and
// links its name to flagfilter.com, so the reviewer can judge a row without leaving
// the PR. See tag-audit/README.md.
//
// Run: node scripts/tag-audit-table.mjs [path/to/proposals.tsv]

import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'tag-audit/proposals.tsv';
const rows = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => {
        const [name, code, term, action, confidence, why] = line.split('\t');
        return { name, code, term, action, confidence, why };
    });

const table = (list) => [
    '| Flag | | Proposal | Confidence | Why |',
    '|---|---|---|---|---|',
    ...list.map(({ name, code, term, action, confidence, why }) => {
        const link = `[${name}](https://flagfilter.com/?q=${encodeURIComponent(name)})`;
        const image = `<img src="https://flagcdn.com/w160/${code}.png" width="80" alt="${name}">`;
        const proposal = action === 'alias' ? `alias \`${term}\`` : `${action === 'add' ? '+' : '−'} \`${term}\``;
        const level = confidence === 'high' ? confidence : `**${confidence}**`;
        return `| ${link} | ${image} | ${proposal} | ${level} | ${why} |`;
    })
].join('\n');

const tags = rows.filter((row) => row.action !== 'alias');
const aliases = rows.filter((row) => row.action === 'alias');

if (tags.length) console.log(`## Tags\n\n${table(tags)}\n`);
if (aliases.length) console.log(`## Aliases\n\n${table(aliases)}\n`);
