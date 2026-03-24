# AGENTS.md

This file documents how AI coding assistants should work in this repository.

## Project context

- Production runtime is Cloudflare Pages with Pages Functions.
- Static frontend files live in the repository root.
- API endpoint lives in `functions/api/report-issue.js`.
- GitHub communication for this project should be written in English.

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

## Legacy files

- `server.js` is legacy and not used in Cloudflare production.
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
