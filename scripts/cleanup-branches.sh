#!/usr/bin/env bash
# Detect and optionally clean up local branches whose GitHub PRs were squash-merged.
# Dry-run by default; pass --yes (-y) to delete verified merged branches.
# Usage: scripts/cleanup-branches.sh [--yes|-y] [--no-fetch]
set -euo pipefail

DELETE=false
FETCH=true

for arg in "$@"; do
    case "$arg" in
        --yes|-y) DELETE=true ;;
        --no-fetch) FETCH=false ;;
        -h|--help)
            echo "Usage: scripts/cleanup-branches.sh [--yes|-y] [--no-fetch]"
            echo "  --yes, -y     Delete local branches whose PRs are MERGED (with matching HEAD SHA)."
            echo "  --no-fetch    Skip 'git fetch --prune' before checking."
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            exit 2
            ;;
    esac
done

if ! command -v gh >/dev/null 2>&1; then
    echo "Error: GitHub CLI (gh) is required." >&2
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Error: node is required." >&2
    exit 1
fi

if [ "$FETCH" = true ]; then
    git fetch --prune --quiet
fi

current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

# Collect branches currently checked out in any worktree so we never try to delete them.
worktree_branches=$(git worktree list --porcelain | awk '/^branch refs\/heads\// { sub(/^branch refs\/heads\//, "", $0); print $0 }')

# Fetch PR metadata once (most recent 300 PRs across all states).
pr_json=$(gh pr list --state all --limit 300 --json headRefName,headRefOid,state,number)

# Gather local branches and their tip SHAs.
branches_data=$(git for-each-ref --format='%(refname:short) %(objectname)' refs/heads/)

# Classify branches with Node for reliable JSON parsing and edge-case handling.
classification=$(PR_JSON="$pr_json" BRANCHES_DATA="$branches_data" CURRENT_BRANCH="$current_branch" WORKTREE_BRANCHES="$worktree_branches" node -e '
const prs = JSON.parse(process.env.PR_JSON || "[]");
const current = process.env.CURRENT_BRANCH || "";
const worktreeSet = new Set((process.env.WORKTREE_BRANCHES || "").split("\n").filter(Boolean));
const protectedBranches = new Set(["main", "master", "chore/pr-screenshots"]);

// Map branch -> latest PR (preferring highest PR number), plus any exact SHA match.
const prsByBranch = new Map();
for (const pr of prs) {
    if (!prsByBranch.has(pr.headRefName)) {
        prsByBranch.set(pr.headRefName, []);
    }
    prsByBranch.get(pr.headRefName).push(pr);
}

const results = [];
for (const line of (process.env.BRANCHES_DATA || "").split("\n")) {
    if (!line.trim()) continue;
    const [branch, sha] = line.split(" ");
    if (protectedBranches.has(branch) || branch === current) continue;

    const list = (prsByBranch.get(branch) || []).sort((a, b) => b.number - a.number);
    const mergedMatch = list.find((p) => p.state === "MERGED" && p.headRefOid === sha);
    const inWorktree = worktreeSet.has(branch);

    if (mergedMatch) {
        results.push({ branch, status: inWorktree ? "MERGED_WORKTREE" : "MERGED", pr: mergedMatch.number });
        continue;
    }

    const latest = list[0];
    if (!latest) {
        results.push({ branch, status: "LOCAL_ONLY", pr: null });
    } else if (latest.state === "MERGED") {
        results.push({ branch, status: "MERGED_DIVERGED", pr: latest.number });
    } else if (latest.state === "OPEN") {
        results.push({ branch, status: "OPEN", pr: latest.number });
    } else {
        results.push({ branch, status: "CLOSED", pr: latest.number });
    }
}

for (const r of results) {
    console.log(`${r.status}\t${r.branch}\t${r.pr ?? "-"}`);
}
')

merged_branches=()
while IFS=$'\t' read -r status branch pr; do
    [ -z "$status" ] && continue
    case "$status" in
        MERGED)
            echo "  [merged PR #$pr]          $branch"
            merged_branches+=("$branch")
            ;;
        MERGED_WORKTREE)
            echo "  [merged PR #$pr, worktree] $branch (skipped: checked out in a worktree)"
            ;;
        MERGED_DIVERGED)
            echo "  [merged PR #$pr, diverged] $branch (skipped: local SHA differs from PR head)"
            ;;
        OPEN)
            echo "  [open PR #$pr]            $branch (kept)"
            ;;
        CLOSED)
            echo "  [closed PR #$pr]          $branch (kept)"
            ;;
        LOCAL_ONLY)
            echo "  [local-only]              $branch (kept)"
            ;;
    esac
done <<< "$classification"

echo ""
if [ ${#merged_branches[@]} -eq 0 ]; then
    echo "No merged local branches to delete."
    exit 0
fi

if [ "$DELETE" = false ]; then
    echo "Dry run: ${#merged_branches[@]} merged branch(es) ready to delete. Re-run with --yes to delete them."
    exit 0
fi

for branch in "${merged_branches[@]}"; do
    git branch -D "$branch"
done
echo "Deleted ${#merged_branches[@]} merged branch(es)."
