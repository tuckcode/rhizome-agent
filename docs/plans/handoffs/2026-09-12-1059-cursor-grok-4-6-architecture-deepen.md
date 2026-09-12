---
session: 2026-09-12T10:59-05:00
model: Cursor Grok 4.6
description: >-
  Deepened Chat shell layout and launch restore. App no longer recombines
  Notes-open flags. AiPanel no longer mutexes rehydrate vs resume. Uncommitted.
---

# Architecture deepen — Waves 1 and 2

**Origin:** Cursor Grok 4.6 · 2026-09-12 · architecture review HTML at
`$TMPDIR/architecture-review-20260912-1030.html`. Did not re-derive the
audit. Did not redesign UX. Working-tree polish stays.

## Wave 1 — Chat-centered shell layout

Interface (`src/lib/shellLayout.ts` + `src/hooks/useChatCenteredShellLayout.ts`):

- `canvas` (`chat-centered` | `classic`)
- `notesOpen`
- `browseOpen`
- `split`
- also: `showRestoreStrip`, `compactSessions`, `compactVaultPanel`

Actions: `ensureNotesOpen` / `openNotes`, `collapseNotes`, `toggleBrowse`,
`setSplit`.

View mode `editor-only` / `editor-list` / `all` still persists under the hood.
C72 lives in this module: Inbox opens Notes and does not close them. Chat
stays the canvas. Closed Notes leave the Show Notes strip.

**App no longer knows:** `showVaultPanel` conjunction of viewMode + compact
width + Beside + compact override + canvas hide. CommandRail gets
`notesOpen` from the module.

Classic shell uses the same discriminant (`classicSidebarVisible` /
`classicNoteListVisible`). ADR-0166 was not reopened.

## Wave 2 — Session restore at launch

Interface (`src/lib/primeSessionRestore.ts` + `src/hooks/usePrimeSessionRestore.ts`):

Given host status + disk summaries → show this conversation:

- `live-attach` (reattached session path)
- `idle-disk` (native host up, no session, last real log)
- `none`

**AiPanel no longer knows:** `reattached`, `running`, `sessionPath`, `isTauri`
for that choice. It passes `enabled`, `host`, `onTranscript`, `onOpen`.

Deleted `usePrimeSessionRehydrate` and `usePrimeResumeLastConversation`.
ADR-0167: a running host is not a Session. A session created this runtime
(`sessionPath` set, not reattached) is not stolen by idle-disk restore.

## Tests

Focused + App + AiPanel + CommandRail + VaultPanel + switcher: green.
`pnpm typecheck` green. ESLint on touched files green.
Codacy opengrep on touched paths: 0 findings.

Playwright unified-shell smoke not run (layout API is the same testids).

## Deferrals

- Candidate 3: Prime Chat as one canvas
- Candidate 4: composer mode seam
- Candidate 5: host status bag
- Width-based Notes collapse stays off (C72). Beside still folds columns.
- No commit. No push. No `/Applications` rebuild.

## Still true

C64 first-2s is not proven. #47 not started. Polish + deepen are both
uncommitted on `3a21f9f`.
