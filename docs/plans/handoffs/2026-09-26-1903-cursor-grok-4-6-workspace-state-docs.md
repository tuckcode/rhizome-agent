---
session: 2026-09-26T19:03Z
model: Cursor Grok 4.6
description: >-
  Weekly docs automation. Synced living developer docs to the shipped
  workspace states (conversation / desk / stacked / focused) and the
  Astra Chat/Settings chrome. Retired Beside-forces-compact.
commits: 835c5bb
---

# Workspace-state living docs

**Origin:** Cursor Grok 4.6 · 2026-09-26 · documentation automation.

Verified against `src/lib/panePresets.ts`, `src/lib/panePresets.test.ts`,
`src/components/chatNoteSplit.ts`, `src/components/FocusedPaneTabs.tsx`,
`src/hooks/usePrimeActiveSessionTitle.ts`, `src/components/ChatComposerBar.tsx`,
`src/components/SettingsBodyNav.tsx`, `src/utils/sessionAutoDistill.ts`.

## Why

The Astra redesign (`70e5f48` and neighbors) shipped as source. Living
briefings still said Notes default open and “Beside forces compact.”
Those sentences send the next session back to
`shouldForceChatShellCompact`.

## Updated

- `docs/ARCHITECTURE.md` — workspace states, Chat chrome, Settings follow
- `docs/YOU-SHOULD-KNOW.md` §2 and composer strip
- `docs/GETTING-STARTED.md` — file table and pitfalls
- `docs/CROSS-MODEL-HANDOFF.md` §26
- `docs/design/pane-presets.md` — shipped correction on the implement packet
- `docs/PUBLIC-PREVIEW.md` — layout row
- `docs/HANDOFF.md` — tip `835c5bb`; `/Applications` last stamped `d0a55f8`

No product code. Native QA not in scope.
