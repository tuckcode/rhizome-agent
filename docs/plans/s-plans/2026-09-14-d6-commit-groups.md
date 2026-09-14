---
session: 2026-09-14T12:17-05:00
model: Grok 4.6 (Cursor)
description: >-
  D6 prep. Named commit groups for the dirty tree. Do not commit until D6
  or Atticus says commit. Never git add -A.
---

# D6 commit groups (not committed)

**HEAD still `4416411`.** Origin `5c629a0`. App `476756c`.
Dirty count ~144 (`git status --short` at 13:44). Stage **by name**. Path-limited commits.

## 1. C72 labels + tests

`src/hooks/commands/viewCommands.ts`
`src/hooks/appCommandCatalog.ts`
`src/lib/locales/en.json` (English keys only)
`src/shared/appCommandManifest.json`
`src/hooks/commands/viewCommands.c72.test.ts` (if untracked)
`src/hooks/commands/navigationCommands.c72.test.ts` (if untracked)
`src/hooks/appCommandCatalog.test.ts`
`docs/plans/c72-notes-delta.md`
`src/components/KeyboardShortcutsDialog.tsx`
`src/components/KeyboardShortcutsDialog.test.tsx`

## 2. D2/D3 Chat readability

`src/components/ChatComposerDeck.tsx`
`src/components/ChatComposerDeck.contextPill.test.tsx`
`src/components/ChatComposerFoot.tsx`
`src/components/ChatComposerFoot.test.tsx`
`src/components/ChatPreflightBanner.tsx`
`src/components/ChatPreflightBanner.test.tsx`
`src/components/AiPanelChrome.tsx`

D3 queue copy is already locked in `AiPanelComposer.queue.test.tsx`
([1245](../handoffs/2026-09-14-1245-cursor-grok-4-6-d3-test-gap.md)). No extra test.

## 3. Neighbor tests only

`src/components/AiPanel.test.tsx`
`src/components/PrimeExtensionsSection.test.tsx`
`src/components/SettingsPanel.test.tsx`
`src/components/usePrimeSessionSwitcher.test.tsx`
`src/components/PrimeSessionList.test.tsx`
`src/components/AiMessage.test.tsx`
`src/lib/composerPromptHistory.test.ts`
`src/lib/replySuggestions.test.ts`
`src/utils/messageTimestamp.test.ts`
`src/utils/nativeContextMenu.test.ts`
`src/lib/aiAgentPermissionMode.test.ts`
`src/components/PrimeThinkingToggle.test.tsx`
`src/components/PrimeModelPicker.test.tsx`
`src/components/PrimeProviderStatusSection.test.tsx`
`src/components/graph/GraphControls.test.tsx`
`src/App.layout-edges.test.ts`
`src/lib/parked-organs.test.ts` (TokenJuice / kanban leftover)
`src/components/StatusBar.test.tsx`
`src/components/MyceliumView.test.tsx`
`src/components/CommandRail.test.tsx`
`src/App.test.tsx`
`src/components/PrimeActiveCloseDialog.test.tsx`
`src/components/PrimeSessionSubhead.test.tsx`
`src/utils/aiPromptBridge.test.ts`
`src/hooks/useNavigationGestures.test.ts`
`src/utils/streamAiAgent.test.ts`
`src/components/BreadcrumbBar.test.tsx`
`src/components/SessionImportSettingsSection.test.tsx`
`src/components/editor-content/EditorContentLayout.test.tsx`
`src/components/AiPanelComposer.queue.test.tsx`
`src/components/AiPanelChrome.scroll.test.tsx` (C70 clock leftover)
`src/components/LinuxTitlebar.test.tsx` (useDragRegion leftover)
`src/components/VaultContentSettingsSection.test.ts` (#36 no timezone leftover)
`src/components/ChatHome.test.tsx`
`src/components/WelcomeScreen.tsx`
`src/components/WelcomeScreen.test.tsx`
`tests/smoke/offline-onboarding-status.spec.ts`
`tests/smoke/getting-started-template.spec.ts`
`src/utils/gettingStartedVault.ts`
`src/utils/gettingStartedVault.test.ts`
`src/components/ChatPreflightBanner.test.tsx` (empty-vault leftover; also in group 2)
`src/hooks/usePrimeHostStatus.test.ts` (empty-vault status poll leftover)
`src/hooks/usePrimeSessionRestore.test.ts` (last-conversation needs no vault)
`src/components/NoteList.contextMenu.test.tsx` (Copy file path leftover, not selected-text Copy path)
`src/hooks/useNoteLockMode.test.ts` (C68 lock is not vault editor_mode)

## 4. W7 extra HOME tests (Rust)

`src-tauri/src/prime_vault_skill.rs`
`src-tauri/src/vault_list.rs`
`src-tauri/src/prime_session_host.rs` (HOME-cwd session name leftover test only)
`src-tauri/src/lib.rs` hide-on-close **test hunk only** — product `mod secure_fs` is group 7

## 5. Astra design pack + living docs

`src/components/AboutSettingsSection.test.tsx`
`docs/design/brand/2026-09-14-handoff/`
`docs/design/brand/2026-09-13/README.md`
`docs/design/memory-loop.md`
KEEP living pages + `docs/plans/s-plans/2026-09-14-*`
`docs/GETTING-STARTED.md` (secure_fs + MCP data-only + import-`1`)
`src/hooks/C64.md` (still NOT RUN stamp)
`docs/ARCHITECTURE.md` / `docs/ABSTRACTIONS.md` (secure_fs one-liners)
Morning handoffs `docs/plans/handoffs/2026-09-14-*`
`AGENTS.md` — import-`1` gate on list-rows (one line)
`.cursor/skills/rhizome-ship/` (un-ignored via `.gitignore` allow-list)
`.gitignore` (ship-skill allow-list + R1 `.env.production` / staging / development)

Also dirty — ride this group, do not invent a ninth:

`docs/ASTRA_GOD_PLAN.md`
`docs/ASTRA_PACKET.md`
`docs/IDENTITY.md` (Agent ≠ Desktop leftover stamp)
`docs/BOARD.md`
`docs/CROSS-MODEL-HANDOFF.md`
`docs/HANDOFF.md`
`docs/MORNING.md`
`docs/NEXT.md`
`docs/YOU-SHOULD-KNOW.md`
`docs/WINDOWS-DEV.md` (C42 skip leftover)
`docs/design/prime-agent-surface.md`
`docs/design/prime-spoken-surface.md`
`docs/design/import-jsonl-routes.md` (paper only)
`docs/plans/c66-agent-profile.md`
`docs/plans/hide-on-close-helpers.md`
`docs/plans/import-jsonl-decision.md` (paper only)
`docs/plans/issue-36-timezone-setting.md`
`docs/plans/issue-52-menu-bar-done.md`
`docs/plans/issue-57-ghost-compat.md`
`docs/plans/s-plans/2026-09-13-astra/` (W1–W11 leftover stamps)
`docs/plans/living-docs-audit.md`
`docs/plans/morning-native-observer.md`
`docs/plans/mutate-queued-message.md`
`docs/plans/pr-66-supersession.md`
`docs/plans/rhizome-ship-skill.md`
`docs/plans/session-mouse-back.md`
`docs/plans/w11-card-status.md`
`docs/plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md`

`.cursor/` as a dirty *directory* is not a group. Stage only
`.cursor/skills/rhizome-ship/SKILL.md`. Rechecked 14:44 — `git add -n .cursor`
still ship-skill only.

## 6. Astra S1–S4 security (source only)

`mcp-server/vault.js`
`mcp-server/agent-instructions.js`
`mcp-server/vault.security.test.js`
`src/lib/sensitiveTextRedaction.ts`
`src/lib/sensitiveTextRedaction.test.ts`
`src/lib/feedbackDiagnostics.ts`
`src/lib/feedbackDiagnostics.test.ts`
`src/lib/telemetry.ts`
`src/lib/telemetry.test.ts`
`docs/plans/s-plans/2026-09-14-security-audit/`
Security handoffs `docs/plans/handoffs/2026-09-14-1246*` and `2026-09-14-1255*`
`docs/plans/handoffs/2026-09-14-1258*` `2026-09-14-1300*` `2026-09-14-1305*`

## 7. Astra R2–R4 native files

`src-tauri/src/secure_fs.rs` (new)
`src-tauri/src/settings.rs`
`src-tauri/src/ai_models.rs`
`src-tauri/src/telemetry.rs` (R4 + leftover `gsk_` / `github_pat_` scrub)

`src-tauri/src/lib.rs` has **two** hunks:

- `mod secure_fs` — this group
- W7 hide-on-close **test-only** — group 4

Do not `git add src-tauri/src/lib.rs` into both commits. Prefer one
Rust commit that names both reasons, or path-commit group 7 first
and leave the test hunk for group 4 only if the hunks can be split.

## 8. Bounded dep pins (not Tiptap)

`pnpm-workspace.yaml`
`mcp-server/package.json`
`pnpm-lock.yaml`

Keep this **off** the S1–S4 source commit. Tiptap stays parked.

Do not close #46. Do not rebuild Applications. MCP bundle is generated (`src-tauri/.gitignore`).

## Do not put in a “ship” commit

`docs/plans/import-jsonl-decision.md` / `import-jsonl-routes.md` unless
the diff is paper-only (no list-import UI).
`docs/plans/handoffs/2026-09-12-1714-rhizome-deepseek-v4-flash-thinking-pill.md` — do not touch.

## Stop

No `git add -A`. No push. No Applications rebuild. D6 is the last 45
minutes (~15:45 CT).

## Inventory 13:50 CT (do not `git add .cursor`)

`.gitignore` re-ignores `.cursor/skills/*` except `rhizome-ship`.
`git add -n .cursor` lists **only** `.cursor/skills/rhizome-ship/SKILL.md`.
Do **not** add `.cursor/skills/impeccable/`. Rechecked 14:42 — still
ship-skill only.

Dirty count **266** at 15:28 (handoffs 1115–1493 + leftover tests).
Groups still hold. One orphan: `.cursor/` (ship-skill only). Paper-only import pages
(`import-jsonl-decision.md`, `import-jsonl-routes.md`) may ride group 5.
Never touch `2026-09-12-1714-rhizome-deepseek-v4-flash-thinking-pill.md`.

## Rust dirt check (restamped 13:38)

**Origin:** Grok 4.6 · 2026-09-14 13:38 · D6 dirt check (no commit)

The 13:11 line “all three dirty Rust files are test-only” is **false now**.

**Product (group 7):**

- `secure_fs.rs` — new, untracked
- `settings.rs` / `ai_models.rs` / `telemetry.rs` — owner-only write + Sentry scrub
- `lib.rs` **`+mod secure_fs;`** — product. Must travel with group 7.

**Test-only (group 4):**

- `prime_vault_skill.rs` — HOME symlink is never a vault
- `vault_list.rs` — tilde / HOME-symlink refused
- `prime_session_host.rs` — HOME-cwd session-name leftover test only
- `lib.rs` hide-on-close **test body** only

Do not `git add src-tauri/src/lib.rs` into both commits. Prefer one Rust
commit that names both reasons, or put `mod secure_fs` with group 7 and
leave the hide test in the same commit (one file, two reasons).
