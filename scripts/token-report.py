#!/usr/bin/env python3
"""Summarise Claude Code token usage for this project from session transcripts.

Usage: python3 -I scripts/token-report.py [projects_dir]
"""
import collections
import glob
import json
import os
import sys

default = os.path.expanduser("~/.claude/projects/-Users-macuser-Documents-github-budget-bubby")
root = sys.argv[1] if len(sys.argv) > 1 else default
keys = ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
total, out_by_model, sessions = collections.Counter(), collections.Counter(), []
for path in glob.glob(os.path.join(root, "*.jsonl")):
    s = collections.Counter()
    for line in open(path):
        try:
            msg = json.loads(line).get("message")
        except ValueError:
            continue
        usage = msg.get("usage") if isinstance(msg, dict) else None
        if not usage:
            continue
        for k in keys:
            s[k] += usage.get(k, 0)
        out_by_model[msg.get("model")] += usage.get("output_tokens", 0)
    total.update(s)
    sessions.append((s["cache_read_input_tokens"], os.path.basename(path)[:8], s))
print(f"sessions: {len(sessions)}")
print({k: total[k] for k in keys})
out = sum(out_by_model.values()) or 1
for model, n in out_by_model.most_common():
    print(f"  {model}: {n:,} output ({n / out:.0%})")
print("top sessions by cache reads:")
for reads, sid, s in sorted(sessions, reverse=True)[:5]:
    print(f"  {sid}: reads={reads:,} writes={s['cache_creation_input_tokens']:,} out={s['output_tokens']:,}")
