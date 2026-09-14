---
session: 2026-09-14T15:04-05:00
model: Grok 4.6 (Cursor)
description: >-
  C70 clock reaches Chat history. Linux titlebar uses useDragRegion.
  #51 Case 2 and #36 timezone stay deferred. No commit.
commits: uncommitted
---

# C70 clock + Linux drag + parked leftovers

**Origin:** Cursor Grok 4.6 · 2026-09-14 15:04 · leftover tests.

Chat history still shows the local clock (`3:35p`) when a turn
carries `createdAtMs`. Linux chrome still uses `useDragRegion`, not
`data-tauri-drag-region`. Reply pills still read one string — #51
Case 2 (app-state Tab) stays unbuilt. Settings still has date-format
only — #36 timezone stays unbuilt. Nous Portal models share the Chat
picker when the catalog includes them. Packaged MCP stays generated
and gitignored.

```bash
npx vitest run \
  src/components/AiPanelChrome.scroll.test.tsx \
  src/components/LinuxTitlebar.test.tsx \
  src/lib/replySuggestions.test.ts \
  src/components/VaultContentSettingsSection.test.ts
```

**PASS.** No product edit. Do not speak `mutate_queued_message`.
Do not add a timezone picker. Do not add Case 2. Do not type `1`.

## Not this window

- C64 / W4 / hide live-check / last-idle relaunch still **NOT RUN**.
  App still `476756c`. Do not launch.
- D6 commits wait ~15:45.
