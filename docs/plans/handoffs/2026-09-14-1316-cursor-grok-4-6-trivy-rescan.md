---
session: 2026-09-14T13:16-05:00
model: Grok 4.6 (Cursor)
description: >-
  Codacy Trivy after the js-yaml / fast-uri pins. Live lockfile High
  is Tiptap only. Stale worktrees still show old pins. No commit.
commits: none
---

# Trivy rescan after dep pins — 2026-09-14 13:16

**Origin:** Cursor Grok 4.6 · Astra leftover · no commit

`codacy-cli analyze --tool trivy`. Did not write SARIF into the repo.
Did not scan HOME. Did not bump Tiptap.

## Live lockfiles only

`pnpm-lock.yaml` + `src-tauri/Cargo.lock` + `mcp-server/`:

| Severity | Count | Notes |
|---|---|---|
| High | **2** | `@tiptap/core` 3.19.0 and 3.22.5 only |
| Medium | 11 | otel, Tiptap (second advisory), fflate, hono 4.12.34, qs, glib |
| Low | 5 | cargo leftovers |

`js-yaml` 3.15.1 and `fast-uri` 3.1.5 **do not appear** on the live
lockfile. The pin landed.

Stale copies under `.worktrees/pr-5*` and
`.claude/worktrees/…` still list the old pins. Those trees are not
this checkout. Do not “fix” them from here.

## Opengrep

`codacy-cli analyze --tool opengrep` on the S1–S4 / R2–R4 source
paths: **0 findings**.

Tiptap High stays parked
([1310](2026-09-14-1310-cursor-grok-4-6-tiptap-reachability.md)).
Do not bump Hono / qs / fflate in this window.
