---
session: 2026-10-17T03:45Z
model: Cursor Grok 4.6
description: >-
  Native loop read-only tools: read_file, list_dir, grep, and glob on the
  #193 registry, scoped to canonical vault and workspace roots.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · native file-tools PR 2 (read-only)

Four read-only tools sit on the existing `rhizome_loop/tools` registry.
Each has `ToolPolicy::ReadOnly`: offered in Limited tools and Power User,
auto-run, no approval card. Paths canonicalize (`..` and symlinks) and
must land inside the current workspace or another mounted vault root.

`ignore` and `globset` were added (MIT/Unlicense). Edit tools were not
started.

Localization: none — English only (C18).
PostHog: no event needed because this is loop policy, not a new UI action.
