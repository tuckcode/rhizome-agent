#!/usr/bin/env bash
# Blocks the three git mistakes that cost this repo real work on 2026-08-29.
# Each is a rule in AGENTS.md; agents followed two of them and still collided,
# so the rule is enforced here rather than trusted to memory.
#
# Reads the PreToolUse payload on stdin, emits a permissionDecision.
set -uo pipefail

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null) || cmd=""
[ -z "$cmd" ] && exit 0

deny() {
  jq -nc --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

# --no-verify skips the gates entirely. AGENTS.md: never.
#
# Matched as a real argument to git, not as a substring. The first version
# fired on `echo "harmless probe --no-verify"` — a string, not a flag — and then
# blocked every attempt to edit this file, since the fix had to mention the
# flag. A guard that blocks talking about the thing is a guard people route
# around.
if printf '%s' "$cmd" | grep -Eq '(^|[;&|] *)git .*(^| )--no-verify( |$)'; then
  deny "AGENTS.md forbids --no-verify: it skips the gates that catch broken pushes. Fix the failure instead."
fi

# `git add -A` / `git add .` / `git add <dir>` sweeps up other agents' work.
if printf '%s' "$cmd" | grep -Eq '(^|[;&|] *)git +add +(-A|--all|\.)( |$)'; then
  deny "AGENTS.md: stage your own files by name, never 'git add -A/.'. On 2026-08-29 a broad add swallowed 591 lines of another agent's in-progress work."
fi

# A bare `git commit` commits the whole index, including files someone else
# staged seconds ago. The path form commits only what it names.
if printf '%s' "$cmd" | grep -Eq '(^|[;&|] *)git +commit( |$)' \
   && ! printf '%s' "$cmd" | grep -q -- ' -- '; then
  deny "AGENTS.md: use 'git commit -- <paths>'. A bare 'git commit' commits the entire index, including anything another agent staged. That happened twice on 2026-08-29."
fi

exit 0
