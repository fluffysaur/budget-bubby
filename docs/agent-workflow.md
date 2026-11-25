# Budget Bubby - Git & Workflow

Loaded on demand from [AGENTS.md](../AGENTS.md). Read before committing, branching, opening PRs, adding migrations, taking screenshots or filing issues.

## 7. Git & Workflow

### A. Approval Gates

- Editing files and running local checks is free. **Never commit, push, or open/update a PR until the user explicitly says so.**
- Each commit, push, and PR needs its own approval. Approval for one does not carry over to the next.
- History-altering or destructive git commands (`stash`, `reset`, `rebase`, `clean`, branch/worktree deletion) also need explicit approval.

#### `--express` (standing approval for one invocation)

Passing the literal `--express` flag to a skill (e.g. `pickup-issue --express`, `raise-issue --express`), or starting a message with "express", is the user's explicit approval for the steps that skill names. It removes the "may I?" prompts only.

- **Scope:** that one invocation (one issue, one branch). Later commits or pushes (e.g. after review comments) ask again unless `--express` is passed again.
- **Still enforced:** the quality gate (C), the branching rules (B: no `main`, no force-push, never merge, no `--no-verify`), the privacy audit, approval for destructive git commands, and the `needs-db` confirmation. Any failure stops the run and is reported.
- **Audit trail:** end with the PR/issue URL, a checks summary and a list of what was done unprompted (commit message, branch pushed, screenshots).
- **Pickup:** the issue is confirmed once (naming an issue number counts as confirmation); the run then branches, implements, runs `npm run check`, commits, pushes, pushes PR screenshots to `chore/pr-screenshots` if UI changed, and opens the PR. It stops at the open PR.
- **Raise:** skips the "create this issue?" gate. The draft is still printed, the duplicate check and privacy audit still run, and a duplicate match stops and asks.

### B. Branching

- **Never commit or push directly to `main`.** Never force-push.
- Work on a branch cut from an up-to-date `main`, named `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `docs/<slug>`, or `chore/<slug>`.
- Changes reach `main` only through a pull request. Agents never merge PRs.
- Do not create `subagent-*` branches. Remove any worktree you create once finished.
- **Squash-merged branch cleanup:** PRs are squash-merged into `main` for Release Please, so `git branch --merged` will not detect them. Run `pnpm run cleanup:branches` to inspect local branches against GitHub PR status (dry-run), and `pnpm run cleanup:branches -- --yes` (with user approval) to delete verified merged branches.

### C. Quality Gate (before proposing a commit or PR)

- `npm run lint` (0 errors, 0 warnings), `npm run build`, and `npm test` must pass. Run `npm run test:e2e` when UI flows changed.
- If any UI changed (components, pages, layouts, styles, copy, icons, badges, modals, themes, or user-visible flows), capture before/after screenshots on demo data per §G before proposing or opening a PR.
- Report failures as they are. Never use `--no-verify`, skip hooks, or delete/disable tests to get green.

### D. Commits & Pull Requests

- Conventional commits: `feat(budget): ...`, `fix(mobile): ...`, `refactor: ...`. Keep commits small and focused.
- PR descriptions state what changed, why, how it was verified, and include a `## Screenshots` before/after table whenever UI changed (per §G). If no UI changed, state `Screenshots: N/A — no UI changes` (or note why browser capture was blocked in the environment).

### E. Repo Hygiene

- Never commit secrets or `.env*` files (only `.env.example` is tracked), or build artifacts (`dist/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`).
- Do not install or upgrade dependencies without asking.
- Do not mix unrelated refactors or reformatting into a feature branch; keep diffs minimal without re-wrapping untouched code.
- When retiring named runtime caches in `src/sw.ts`, explicitly delete them in the SW `activate` handler (`caches.delete(...)`).
- Ask before destructive actions: deleting files, dropping data, resetting the DB.

### F. Supabase Migrations

- Name files with a full timestamp: `YYYYMMDDHHMMSS_name.sql`.
- Edit a migration in place only while it is unapplied and unpushed. Once applied, add a new migration instead.
- Do not squash migrations without asking.

### G. PR Screenshots

The repo is private but kept publishable, and screenshots stay in git history, so treat every screenshot as public.

- **When required (mandatory):** Every PR that changes any UI — `src/components/`, `src/pages/`, `src/index.css`, layout, spacing, styles, copy, icons, badges, modals, themes, or user-visible flows — must attach before/after screenshots before the PR is opened (or updated). Never silently omit them. If the environment genuinely cannot run a browser, explicitly state the blocker in `## Screenshots` and treat screenshot verification as unverified.
- **Demo data only.** Capture from the e2e dev server, which forces mock mode (`playwright.config.ts` sets empty Supabase env vars). Never capture from the live DB.
- **Nothing personal in the PR.** No real names, balances, salaries or emails, in images or in the PR body.
- **Sizes:**
    - 360×800 (Android) and 390×844 (iPhone), in light and dark mode.
    - Set the theme via the app's theme `localStorage` key in an init script; the app uses a `dark` class, not media queries.
    - Add 1280×800 when desktop layout changed.
- **Before and after:**
    - Capture "before" on the base branch (`main`) and "after" on the PR branch (use a temporary worktree on `main` if you are already on the PR branch).
    - Text-only PRs may skip dark mode.
- **Hosting:**
    - Screenshots live on the orphan branch `chore/pr-screenshots`. It is never merged and never deleted.
    - Use a separate worktree: `git worktree add --orphan -b chore/pr-screenshots ../bb-shots` the first time, or `git worktree add ../bb-shots chore/pr-screenshots` after that.
    - Put the images in a folder named after the PR branch, with `/` replaced by `-`, e.g. `fix-offline-queue/after-390-dark-home.png`. Commit, push, then remove the worktree.
    - Embed them in the PR body with `https://github.com/fluffysaur/budget-bubby/blob/chore/pr-screenshots/<folder>/<file>.png?raw=true`, in a before/after table. Do not use `raw.githubusercontent.com` URLs: the repo is private, so GitHub's image proxy fetches them anonymously and they render broken.
    - Verify with `git ls-tree -r --name-only origin/chore/pr-screenshots` that the images are pushed and filenames match the PR body links before creating the PR. Anonymous `curl` of the image URLs returns 404 on a private repo, so don't use it as a check.
- **Not test baselines.** Screenshots are never committed to feature branches or used as visual-regression baselines.

### H. Backlog (GitHub Issues)

Known, unscheduled fixes and improvements are GitHub issues labelled `backlog`. Each also carries one priority label:

- **`P0`:** money or data is wrong.
- **`P1`:** something is broken or blocks a flow.
- **`P2`:** friction or polish.
- **`P3`:** ideas.

Add `bug` or `enhancement` to every backlog issue. Add `needs-db` when the fix needs SQL the user runs on the live DB.

- **Adding:** If you find a bug or improvement outside your task's scope, open an issue rather than fixing it in the same PR. Use `gh issue create --label backlog --label P<n> --label bug|enhancement`. The body has these lines:
    - **Story:** As a <who>, I want <what>, so that <why>.
    - **Where:** file:line
    - **Done when:** acceptance criteria
    - **Refs:** plan, audit ID or PR
    - **DB change:** none, or the SQL the user must run

    Keep issues publishable: placeholder names and amounts only, never personal names, real balances or other private data.

- **Clearing:** The PR that fixes an issue says `Closes #<n>` in its body.
- **Picking up:** Run `gh issue list --label backlog --label P0`, then P1 and so on, and take the highest unblocked issue. Issues labelled `needs-db` wait until the user confirms the SQL has run.

### I. Releases & Versioning

Releases are automated via **Release Please** (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`):

- **Scheme:** SemVer on `0.x.y` while in beta (`bump-minor-pre-major: true`).
    - `feat:` bumps minor (`0.1.0` → `0.2.0`).
    - `fix:` / `perf:` bumps patch (`0.1.0` → `0.1.1`).
    - Breaking changes stay pre-`1.0` until explicitly promoted.
- **Flow:** PRs merge into `main` (PR previews still deploy on Vercel), and Release Please updates a single open Release PR (`chore(main): release X.Y.Z`) that bumps `package.json`, `.release-please-manifest.json`, and `CHANGELOG.md`. Production deploys on Vercel are gated via `vercel.json` (`ignoreCommand` → `scripts/vercel-ignore.sh`): non-release merges to `main` are skipped, and merging the Release PR creates the `vX.Y.Z` git tag, GitHub Release, and triggers the production deploy.
- **Release notes ("What's new"):** Every Release PR adds an entry for its version to `src/data/releaseNotes.ts`, newest first. The agent drafts it from the user-facing `feat`/`fix`/`perf` lines in the Release PR's changelog and the user edits it.
    - One friendly sentence per item (≤120 chars), a `new` / `better` / `fixed` tag, a lucide icon, and an optional in-app `to` route for "Try it".
    - Skip internal changes (tests, CI, refactors, docs). Use `items: []` for a release with nothing user-facing: no popup.
    - `src/lib/__tests__/releaseNotes.test.ts` fails when the `package.json` version (from `FIRST_NOTED_VERSION` on) has no entry, so the Release PR stays red until notes are added.
    - Each device shows unseen notes once after an update (`bb_whats_new_v1` in localStorage); full history is under Settings → What's New.
- **Promoting to `1.0.0`:** Include a commit footer `Release-As: 1.0.0` when ready for public launch.
- **In-app visibility:** The Settings modal footer displays `vX.Y.Z (<short-sha>)` (injected at build time via `vite.config.ts`) to verify PWA updates on devices even between releases.
- **GitHub repo setting:** Requires `Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests`.

