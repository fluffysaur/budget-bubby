#!/usr/bin/env bash
# Vercel Ignored Build Step (referenced from vercel.json `ignoreCommand`).
# Exit 0 = skip build, Exit 1 = proceed with build.
#
# - PR / Preview deployments always build.
# - Production deployments only build when a Release Please PR is merged
#   (detected via changes to .release-please-manifest.json, with a commit
#   message fallback for shallow depth-1 clones).
set -euo pipefail

if [ "${VERCEL_ENV:-}" != "production" ]; then
    echo "Non-production deployment (VERCEL_ENV=${VERCEL_ENV:-unset}): proceeding with build."
    exit 1
fi

if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    if ! git diff --quiet HEAD^ HEAD -- .release-please-manifest.json; then
        echo "Release commit detected (.release-please-manifest.json changed): proceeding with production build."
        exit 1
    fi
    echo "Non-release commit on main: skipping production build until Release PR is merged."
    exit 0
fi

commit_msg="${VERCEL_GIT_COMMIT_MESSAGE:-$(git log -1 --pretty=%s 2>/dev/null || true)}"
if echo "$commit_msg" | grep -qE '^chore\(main\): release |release-please--branches--main'; then
    echo "Release commit detected from commit message: proceeding with production build."
    exit 1
fi

echo "Non-release commit on main (shallow fallback): skipping production build."
exit 0
