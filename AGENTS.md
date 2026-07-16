# AGENTS.md

This file documents how AI coding assistants should work in this repository.

## Project context

- Production runtime is Cloudflare Pages with Pages Functions.
- Static frontend files live in the repository root.
- API endpoint lives in `functions/api/report-issue.js`.
- GitHub communication for this project should be written in English.
- The flag detail modal contains Amazon Associates shop links (tag `flagfilter-20`).
  Affiliate links must keep `rel="noopener noreferrer sponsored nofollow"` and the
  localized disclosure line next to them.

## Branching and git workflow

- Always start by updating `master` before creating a new branch:
  - `git checkout master`
  - `git pull --ff-only origin master`
- Before starting new work, verify that the latest expected merge commit is actually present in `master`.
- Prefer small, focused branches and small pull requests.
- After each commit, push the branch so preview deployments and PR checks can run.
- If a PR is already open for the same branch, continue pushing fixes to that branch until it is ready to merge.

## Pull requests

- PR titles and descriptions should be in English.
- PR descriptions should be provided in Markdown.
- Keep PRs focused on one theme when possible.
- Prefer iterative PRs over large bundled changes.
- PRs are reviewed by the Codex bot; request a (re-)review by commenting `@codex review`.
- Squash-merge once CI is green and review feedback is resolved; head branches are
  auto-deleted on merge, so also delete the local branch afterwards.

## Frontend conventions

- The Content-Security-Policy in `_headers` is enforced. Any new external origin
  (script, stylesheet, image, font, fetch/beacon target) must be added to the matching
  CSP directive in the same PR, or the browser will silently block it in production.
- No inline event handlers (`onclick="..."`). Bind listeners with `addEventListener`
  so markup stays compatible with the CSP.
- Every user-facing string — including `aria-label`s and tooltips — needs keys in both
  `i18n/ui/en.json` and `i18n/ui/es.json`.
- Icons are an inline SVG `<symbol>` sprite in `index.html` (Font Awesome 6 solid
  paths, ids `#i-*`). Add new icons to the sprite; do not add icon CDNs or webfonts.
- `index.html` preloads the first flag image (`w320/ad.webp`) as the LCP image.
  Any change that alters which flag renders first must update that preload.

## Testing strategy

- Prefer small, stable automated tests over broad but flaky ones.
- Expand Playwright coverage incrementally.
- Use mocked API responses in UI tests when external services are not the thing being tested.
- Before adding new tests, prefer building from the latest green test baseline in `master`.

## Cloudflare-specific guidance

- Treat Cloudflare Pages as the production source of truth.
- Do not assume Workers-only bindings are available in Pages Functions.
- If something depends on Cloudflare runtime capabilities, verify Pages compatibility before documenting or relying on it.
- Keep secrets out of the repository. Use Cloudflare secrets or environment variables where appropriate.
- Zone feature state (as of 2026-07): Cloudflare Fonts enabled (rewrites the Google
  Fonts `<link>` to same-origin; the CSP still allows the Google Fonts origins as its
  fallback), Email Obfuscation enabled (keep it — its inline script is why script-src
  has 'unsafe-inline'), Rocket Loader disabled, Web Analytics enabled (its beacon
  origins are allowed in the CSP).
- Web Analytics undercounts by design: Edge Tracking Prevention, Safari ITP and ad
  blockers block the beacon. Use it for traffic composition (referrers, paths), not
  absolute counts. Zone-level "unique visitors" counts include bots/crawlers.

## Environment constraints (verification)

- The assistant sandbox typically has no Node/npm; Playwright runs in CI
  (`.github/workflows/ui-tests.yml`), not locally. Write tests, let CI validate them.
- The sandbox may not be able to reach `flagfilter.com` (DNS). Verify production
  behavior via the `*.pages.dev` preview deployment or ask the user to check.
- `_headers` (CSP/security headers) cannot be exercised by the Playwright suite —
  tests run against a plain static file server. Changes there need verification on
  the deployed site after merge.

## Legacy files

- Before removing legacy files, verify whether any meaningful behavior still exists only there.
- Do not assume a legacy file is safe to remove until its remaining responsibilities have been mapped to the current runtime.

## Documentation expectations

- When behavior changes, update README if the change affects:
  - deployment
  - runtime behavior
  - secrets/configuration
  - localization workflow
  - testing workflow

## Communication preferences

- Be direct and concise.
- Explain tradeoffs clearly when there is non-obvious risk.
- If something cannot be verified locally, say so explicitly.
