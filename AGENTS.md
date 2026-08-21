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
- `flag-baseline/` holds 40px copies of every flag, used only to detect that flagcdn
  changed an image. Never reference them from the page and never edit them by hand —
  they are meaningful precisely because they record what upstream served the last time
  a human agreed to it. See the Flag image watch section in README.

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
- `index.html` preloads the first flag image (`w320/af.webp`) as the LCP image.
  The grid is sorted by localized name, so that is Afghanistan. Any change that
  alters which flag renders first must update that preload.

## Testing strategy

- Prefer small, stable automated tests over broad but flaky ones.
- Expand Playwright coverage incrementally.
- Use mocked API responses in UI tests when external services are not the thing being tested.
- Before adding new tests, prefer building from the latest green test baseline in `master`.
- A *Flag images changed upstream* pull request is never a rubber stamp. The diff shows
  each changed flag before and after; merging accepts the new picture, which is the only
  reason a human is in the loop at all. Then follow the checklist in the PR body: a
  changed flag invalidates its tags, its `symbolism` and `funfacts` in both
  `flaginfo.json` and every `i18n/flags/*.json`, its `adopted` date, and possibly its
  flag family membership.
- If that workflow fails, it is telling you something. It refuses to write when more than
  ten images differ, because that is a re-encode upstream rather than ten countries
  redesigning their flags. Do not raise the threshold to make it pass.

## Translations (POEditor)

- `i18n/flags/*.json` lives in two places: hand-edited in this repository, and in
  POEditor, where volunteers translate. The two drift, and nothing detects it.
- **Any change to flag prose is a sync obligation.** If a PR touches `symbolism` or
  `funfacts` — in `flaginfo.json` or in an overlay — say so in the PR body and remind
  the owner to sync POEditor. A reworded English source leaves the overlay translating
  a sentence that no longer exists.
- **Never sync blind, in either direction.** `pull` overwrites the repository and
  `push` overwrites POEditor; both are silent. Download to a scratch path first and
  compare, then decide the direction from what you see:

  ```
  scripts/poeditor-flags-sync.sh pull es /tmp/es-poeditor.json
  jq -n --slurpfile a i18n/flags/es.json --slurpfile b /tmp/es-poeditor.json '
    $a[0] as $repo | $b[0] as $poe |
    (($repo|keys) + ($poe|keys) | unique) as $ks |
    $ks[] | select($repo[.] != $poe[.]) |
    "=== \(.) ===\nrepo:     \($repo[.])\npoeditor: \($poe[.])\n"
  ' -r
  ```

  The path is relative to the working directory: run it from the repository root, or
  the file lands somewhere harmless-looking and the comparison silently passes.
- The direction is usually **push**. The repository has been the working copy for
  every flag-text change so far; POEditor holds what was last uploaded.
- The assistant sandbox cannot run this: `POEDITOR_API_TOKEN` is a secret it does not
  have and should not be given (cloud environment variables are plaintext readable by
  anyone using the environment, and `api.poeditor.com` is not on the Trusted
  allowlist). The owner runs it locally.
- **Always hand over the environment lines with the sync command.** The owner sets
  them per terminal session and does not keep them in a dotfile, so a sync
  instruction without them is incomplete:

  ```
  read -rs "POEDITOR_API_TOKEN?POEDITOR token: "
  export POEDITOR_API_TOKEN
  export POEDITOR_PROJECT_ID=654073
  ```

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

- Keep responses focused, brief, and concise.
- Keep disclaimers and caveats short, and spend most of the response on the main answer.
- When asked to explain something, give a high-level summary unless an in-depth explanation is specifically requested.
- Explain tradeoffs clearly when there is non-obvious risk.
- If something cannot be verified locally, say so explicitly.
- Before your first tool call, say in one sentence what you're about to do. While working, give a brief update only when you find something important or change direction. When you finish, lead with the outcome: your first sentence should answer "what happened" or "what did you find," with supporting detail after it for readers who want it.
- Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.
- Deliver what was asked, at the scope intended. Make routine judgment calls yourself, and check in only when different readings of the request would lead to materially different work. If the request seems mistaken or a better approach exists, say so in a sentence and continue with the task as asked rather than quietly narrowing, widening, or transforming it. Finish the whole task, and stop short of actions that are clearly beyond what was asked.
- Delegate to a subagent only for large tasks that are genuinely independent and parallelizable, such as a wide multi-file investigation. Do not delegate work you can finish yourself in a handful of tool calls, and do not use subagents to verify or double-check your own work. If one subagent can complete the task, use one rather than several, and keep spawn counts low.
- Only correct an earlier statement when the error would change the user's code, conclusions, or decisions. State corrections plainly and briefly, then continue the task. For slips that change nothing for the user, make the fix and move on without noting it.
- **End a session by saying how to clean up after it.** Anything written outside the
  repository — a POEditor download in `/tmp`, a scratch comparison file — and any
  credential exported into the owner's shell is invisible in `git status` and will
  otherwise sit there. List the exact `rm`, `unset` and `git clean -nd` commands,
  and never suggest `git clean -fd` without the dry run first.
- When a change is ready to look at, give the Cloudflare Pages preview link for the
  branch. Prefer the per-deployment URL from the Pages check
  (`https://<hash>.flagfilter.pages.dev`) over the branch alias: `/script.js` and
  `/js/*` are cached for 24 hours and carry no hash in the filename, and the branch
  alias keeps the same hostname across deploys, so a browser that has opened it before
  keeps running the previous build. When only the alias is at hand, say to open it in a
  private window.
