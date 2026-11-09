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
- **Still enforced:** the quality gate (C), the branching rules (B: no `main`, no force-push, never merge, no `--no-verify`), the public-repo privacy audit, approval for destructive git commands, and the `needs-db` confirmation. Any failure stops the run and is reported.
- **Audit trail:** end with the PR/issue URL, a checks summary and a list of what was done unprompted (commit message, branch pushed, screenshots).
- **Pickup:** the issue is confirmed once (naming an issue number counts as confirmation); the run then branches, implements, runs `npm run check`, commits, pushes, pushes PR screenshots to `chore/pr-screenshots` if UI changed, and opens the PR. It stops at the open PR.
- **Raise:** skips the "create this issue?" gate. The draft is still printed, the duplicate check and privacy audit still run, and a duplicate match stops and asks.

### B. Branching

- **Never commit or push directly to `main`.** Never force-push.
- Work on a branch cut from an up-to-date `main`, named `feat/<slug>`, `fix/<slug>`, `refactor/<slug>`, `docs/<slug>`, or `chore/<slug>`.
- Changes reach `main` only through a pull request. Agents never merge PRs.
- Do not create `subagent-*` branches. Remove any worktree you create once finished.

### C. Quality Gate (before proposing a commit or PR)

- `npm run lint` (0 errors, 0 warnings), `npm run build`, and `npm test` must pass. Run `npm run test:e2e` when UI flows changed.
- Report failures as they are. Never use `--no-verify`, skip hooks, or delete/disable tests to get green.

### D. Commits & Pull Requests

- Conventional commits: `feat(budget): ...`, `fix(mobile): ...`, `refactor: ...`. Keep commits small and focused.
- PR descriptions state what changed, why, and how it was verified.

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

This repo is **public**, so everything in a screenshot is public too.

- **Demo data only.** Capture from the e2e dev server, which forces mock mode (`playwright.config.ts` sets empty Supabase env vars). Never capture from the live DB.
- **Nothing personal in the PR.** No real names, balances, salaries or emails, in images or in the PR body.
- **Sizes:**
    - 360×800 (Android) and 390×844 (iPhone), in light and dark mode.
    - Set the theme via the app's theme `localStorage` key in an init script; the app uses a `dark` class, not media queries.
    - Add 1280×800 when desktop layout changed.
- **Before and after:**
    - Capture "before" on the base branch and "after" on the PR branch.
    - Text-only PRs may skip dark mode.
- **Hosting:**
    - Screenshots live on the orphan branch `chore/pr-screenshots`. It is never merged and never deleted.
    - Use a separate worktree: `git worktree add --orphan -b chore/pr-screenshots ../bb-shots` the first time, or `git worktree add ../bb-shots chore/pr-screenshots` after that.
    - Put the images in a folder named after the PR branch, with `/` replaced by `-`, e.g. `fix-offline-queue/after-390-dark-home.png`. Commit, push, then remove the worktree.
    - Embed them in the PR body with `https://raw.githubusercontent.com/fluffysaur/budget-bubby/chore/pr-screenshots/<folder>/<file>.png`, in a before/after table.
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

    The repo is public, so never include personal names, real balances or other private data.

- **Clearing:** The PR that fixes an issue says `Closes #<n>` in its body.
- **Picking up:** Run `gh issue list --label backlog --label P0`, then P1 and so on, and take the highest unblocked issue. Issues labelled `needs-db` wait until the user confirms the SQL has run.

