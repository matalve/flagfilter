# Flagfilter

Flagfilter is a Cloudflare Pages app for exploring, searching, and filtering national flags.

## Runtime

- Production runs on Cloudflare Pages
- Static frontend files live in the repository root
- The issue reporting endpoint is `functions/api/report-issue.js`

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
- `TURNSTILE_SECRET_KEY` enables Cloudflare Turnstile verification on `/api/report-issue`

Turnstile bot protection is split across two keys:

- the **site key** is public and lives in `script.js` (`TURNSTILE_SITE_KEY`); an empty
  value renders no widget
- the **secret key** is a Cloudflare Pages secret (`TURNSTILE_SECRET_KEY`); when it is
  unset the server skips verification entirely

Set the site key before the secret. A site key without a secret is harmless — the
widget renders and reports still go through — while a secret without a site key
rejects every report with 403, because no token is ever minted. Pages reads
environment variables at deploy time, so a new secret needs a redeploy to take
effect, in both the Production and Preview environments.

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
- Base source data (including the per-flag `continent` field used by the continent filter) stays in `flaginfo.json`
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
- `flaginfo.json` is validated in CI (required fields, unique codes, continent coverage): `node scripts/validate-flaginfo.mjs`
- Flag images are watched for upstream changes weekly: see [Flag image watch](#flag-image-watch)
- Flag cross-links (`<a href="?q=…">` inside `symbolism`/`funfacts`, in `flaginfo.json` and every
  `i18n/flags/*.json`) are validated in CI: `node scripts/validate-flag-links.mjs`. A link that
  resolves to nothing is not a visible error — the runtime drops the anchor and keeps the text —
  so the check exists to make that failure loud. Targets resolve against the English flag names
  and codes in `flaginfo.json` whatever language the prose is in, so a translated link target is
  a broken one.

## Flag image watch

Flag images are served from flagcdn at runtime and never re-read, so a country that
changes its flag changes the picture on the site while the tags, colours, symbolism
and fun facts keep describing the old one. Nothing breaks and nothing looks wrong —
the page is just incorrect until somebody notices by eye. This is the watchdog for
that.

`.github/workflows/flag-images.yml` runs `node scripts/sync-flag-images.mjs` every
Monday, and can be run on demand from the Actions tab. The script downloads
flagcdn's `w40` pack, compares it to `flag-baseline/`, and opens a pull request when
anything differs.

### What `flag-baseline/` is

40px-wide copies of every flag the site carries, one PNG per code, plus
`upstream-only.txt` listing codes flagcdn has that `flaginfo.json` does not.

It is detection data, not assets. Nothing on the page references these images, and
nothing should start to — they exist so that a change arrives as a diff GitHub
renders side by side, which is a two-second judgement instead of a description to
interpret. Do not edit them by hand: the whole point is that they say what flagcdn
served the last time a human agreed to it.

### When a pull request arrives

It will be titled *Flag images changed upstream*, and the diff is the evidence:
each changed flag shown before and after. Merging accepts the new baseline, which
is why the workflow cannot do it — a human has to look at the pictures.

Merging is not the end of the job. A changed flag invalidates more than the image,
and the PR body lists it per flag:

- colour tags, and any pattern, symbol or motive tag that described the old design
- `symbolism` and `funfacts` in `flaginfo.json` **and** every `i18n/flags/*.json` overlay
- `adopted`, which is now a different date
- membership in the flag family filters

The PR may also report codes flagcdn has that the site lacks (a flag the site
cannot show) and codes the site carries that flagcdn dropped (the grid is
requesting an image that will not resolve).

UI Tests and CodeQL do not run on it. Both workflows ignore `flag-baseline/**`,
because a PR touching only those PNGs gives Playwright nothing to exercise and
CodeQL nothing to analyze — and since the PR is opened by a bot, a queued run
would sit awaiting approval rather than reporting anything. Cloudflare Pages
still builds a preview. The weekly CodeQL schedule scans the whole repository
regardless.

### When it fails

Failure is deliberate and loud, because a watchdog that fails quietly is worse than
none:

- **More than ten images differ.** That is not ten countries redesigning their flags
  in a week; it is a re-encode or a layout change upstream. Nothing is written and
  the job fails, so the noise never reaches a pull request. Check the pack by hand.
- **The host is unreachable, or the pack is not shaped as expected.** Same treatment.

`node scripts/sync-flag-images.mjs --pack=<zip>` compares against a local archive
instead of downloading one, which is how the logic gets exercised without network
access.

## Support

Donations are welcome:

- Ethereum: `0xfe963F3d5346cEdC24A92BF217745E9c4854C17`

![Ethereum QR Code](eth_qr.png)

## License

GPL-3.0-or-later. See `LICENSE`.
