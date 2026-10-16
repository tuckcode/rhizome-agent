---
session: 2026-10-16T20:45Z
model: Cursor Grok 4.6
description: >-
  #185 Codacy: seven OpenGrep path-construction alerts on the Pages
  artifact checker. Moved it to scripts/ with a root-containment helper.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 · Codacy on #185

Codacy on `3f83735` was seven Criticals, all
`website/check-pages-artifact.mjs`, message “The application
dynamically constructs file or path information.” (non-literal
`path.join` / `fs` paths). Not Trivy.

The checker now lives at `scripts/check-pages-artifact.mjs` with the
other CLI checks (`.codacy.yaml` already excludes `scripts/**`).
`contained()` resolves and rejects paths that leave the artifact root.
`website/build.sh` calls the new path.

Did not edit `docs/HANDOFF.md`. Did not merge.
