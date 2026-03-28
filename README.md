# Flagfilter

Flagfilter is a Cloudflare Pages app for exploring, searching, and filtering national flags.

## Runtime

- Production runs on Cloudflare Pages
- Static frontend files live in the repository root
- The issue reporting endpoint is `functions/api/report-issue.js`
- `server.js` is legacy and not used in Cloudflare production

## Main features

- Search by country name or tag
- Filter by color and other visual attributes
- Flag detail modal with inline related-flag links
- English and Spanish UI
- Report issues to Telegram, GitHub Issues, or both

## Local development

- Install: `npm install`
- Local Pages runtime: `npm run dev`
- Playwright tests: `npm run test:e2e`

## Configuration

Secrets go in Cloudflare, not in the repository.

Required for Telegram reporting:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Required for GitHub issue creation:

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`

Optional:

- `GITHUB_ISSUE_LABELS` default: `reported-from-site`
- `GITHUB_ISSUE_LABEL_PREFIX` default: `flag`

`GITHUB_OWNER` and `GITHUB_REPO` are also defined in `wrangler.toml`.

## Report issue behavior

`/api/report-issue` can send reports to:

- Telegram
- GitHub Issues
- both at the same time

GitHub issues use this format:

- title: `User report - <Flag name> (<flag code>)`
- body starts with `## Report`
- user email addresses are not published
- labels include one base label, one issue-type label, and one automatic flag label such as `flag:se`

If GitHub issue creation succeeds, the frontend can show a direct link to the created issue.

## Internationalization

- UI strings live in `i18n/ui/<lang>.json`
- Flag text overlays live in `i18n/flags/<lang>.json`
- Base source data stays in `flaginfo.json`
- Supported languages today: `en`, `es`

Language selection priority:

1. `?lang=<code>`
2. saved `localStorage` language
3. browser language
4. `en`

Fallback behavior:

- missing or whitespace-only UI strings fall back to English
- missing or whitespace-only flag overlay values fall back to `flaginfo.json`

URL query behavior:

- `?q=...` can prefill the search field on load
- recognized filter terms such as `red`, `europe`, or `cross` activate the matching filter buttons
- remaining query terms stay in the search field
- `Reset` clears both the UI state and the `q` parameter

Inline modal links like `?q=france` are resolved against base flag data so they keep working in translated views.

## Translation workflow

Flags-only POEditor sync script: `scripts/poeditor-flags-sync.sh`

Required environment variables:

- `POEDITOR_API_TOKEN`
- `POEDITOR_PROJECT_ID`

Examples:

- Pull: `POEDITOR_API_TOKEN=... POEDITOR_PROJECT_ID=654073 scripts/poeditor-flags-sync.sh pull es i18n/flags/es.json`
- Push: `POEDITOR_API_TOKEN=... POEDITOR_PROJECT_ID=654073 scripts/poeditor-flags-sync.sh push es i18n/flags/es.json`

Validation and coverage:

- `scripts/validate-flags-i18n.sh i18n/flags/es.json flaginfo.json`
- `scripts/validate-flags-i18n.sh --strict-empty i18n/flags/es.json flaginfo.json`
- `scripts/flags-translation-coverage.sh i18n/flags/es.json flaginfo.json`

Translation contributions are welcome:

- POEditor: <https://poeditor.com/join/project/P7N0JxV3wI>

## Tests and CI

- Playwright tests: `tests/e2e/app.spec.js`
- GitHub Actions workflow: `.github/workflows/ui-tests.yml`
- Data sources: `flaginfo.json` and `https://flagcdn.com/w320/{code}.png`

## Support

Donations are welcome:

- Ethereum: `0xfe963F3d5346cEdC24A92BF217745E9c4854C17`

![Ethereum QR Code](eth_qr.png)

## License

GPL-3.0-or-later. See `LICENSE`.
