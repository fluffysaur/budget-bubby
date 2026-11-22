#!/usr/bin/env bash
# Quality gate with minimal output: one line per step, last 40 lines on failure.
# Usage: scripts/check.sh [lint|build|test|e2e ...]   (default: lint build test)
set -u
steps=("$@")
[ ${#steps[@]} -eq 0 ] && steps=(lint build test)
cmd_for() {
    case "$1" in
        lint) echo "pnpm run lint" ;;
        build) echo "pnpm run build" ;;
        test) echo "pnpm test" ;;
        e2e) echo "pnpm run test:e2e" ;;
        *) echo "" ;;
    esac
}
status=0
for step in "${steps[@]}"; do
    cmd=$(cmd_for "$step")
    if [ -z "$cmd" ]; then echo "SKIP $step (unknown step)"; status=1; continue; fi
    log=$(mktemp)
    if $cmd >"$log" 2>&1; then
        echo "PASS $step"
    else
        echo "FAIL $step ($cmd)"
        sed $'s/\x1b\\[[0-9;]*m//g' "$log" | grep -E 'FAIL|Error|error|✗|×|expected|Tests ' | head -n 20
        status=1
    fi
    rm -f "$log"
done
exit $status
