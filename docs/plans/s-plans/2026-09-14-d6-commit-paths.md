---
session: 2026-09-14T15:25-05:00
model: Grok 4.6 (Cursor)
description: >-
  Exact named paths for D6. Do not commit until ~15:45. Never git add -A.
  Never git add .cursor or a directory.
---

# D6 named paths (15:25)

**HEAD `4416411`.** Origin `5c629a0`. App `476756c`.
Seven commits. `lib.rs` once (native). Messages:
[`2026-09-14-d6-commit-messages.md`](2026-09-14-d6-commit-messages.md).

Dirty **260**. Orphan `.cursor/` means stage
`.cursor/skills/rhizome-ship/SKILL.md` only.

Do **not** `git add` these directories:

- `.cursor/`
- `docs/design/brand/2026-09-14-handoff/`
- `docs/plans/s-plans/2026-09-14-security-audit/`

Name the files below.

## 1. C72 (10)

```
src/hooks/commands/viewCommands.ts
src/hooks/appCommandCatalog.ts
src/lib/locales/en.json
src/shared/appCommandManifest.json
src/hooks/commands/viewCommands.c72.test.ts
src/hooks/commands/navigationCommands.c72.test.ts
src/hooks/appCommandCatalog.test.ts
docs/plans/c72-notes-delta.md
src/components/KeyboardShortcutsDialog.tsx
src/components/KeyboardShortcutsDialog.test.tsx
```

## 2. D2/D3 (7)

```
src/components/ChatComposerDeck.tsx
src/components/ChatComposerDeck.contextPill.test.tsx
src/components/ChatComposerFoot.tsx
src/components/ChatComposerFoot.test.tsx
src/components/ChatPreflightBanner.tsx
src/components/ChatPreflightBanner.test.tsx
src/components/AiPanelChrome.tsx
```

## 3. Neighbor tests (43)

Path-commit the group-3 list in
[`2026-09-14-d6-commit-groups.md`](2026-09-14-d6-commit-groups.md)
plus `src/components/NoteList.contextMenu.test.tsx` and
`src/hooks/useNoteLockMode.test.ts`.

## 4+7. Native (8 files, one commit)

```
src-tauri/src/prime_vault_skill.rs
src-tauri/src/vault_list.rs
src-tauri/src/prime_session_host.rs
src-tauri/src/secure_fs.rs
src-tauri/src/settings.rs
src-tauri/src/ai_models.rs
src-tauri/src/telemetry.rs
src-tauri/src/lib.rs
```

`lib.rs` once. Names both `mod secure_fs` and hide-on-close tests.

## 5. Docs + ship skill

Living docs, handoffs `2026-09-14-*`, W4 `2026-09-13-2235`,
Astra papers, `.gitignore`, `AGENTS.md`, `src/hooks/C64.md`,
`src/components/AboutSettingsSection.test.tsx`.

Ship skill **by file**:

```
.cursor/skills/rhizome-ship/SKILL.md
```

Brand pack **by file**:

```
docs/design/brand/2026-09-14-handoff/ASSET-GALLERY.md
docs/design/brand/2026-09-14-handoff/ASSET-MANIFEST.json
docs/design/brand/2026-09-14-handoff/CURSOR-FIVE-HOUR-PLAN.md
docs/design/brand/2026-09-14-handoff/D5-DOCK-AND-SITE.md
docs/design/brand/2026-09-14-handoff/FRONTEND-DESIGN.md
docs/design/brand/2026-09-14-handoff/INTEGRATION.md
docs/design/brand/2026-09-14-handoff/MEMORY-DIRECTION.md
docs/design/brand/2026-09-14-handoff/PROMPTS.md
docs/design/brand/2026-09-14-handoff/README.md
docs/design/brand/2026-09-14-handoff/REPO-STATE.md
docs/design/brand/2026-09-14-handoff/START-HERE.md
```

Never `2026-09-12-1714-rhizome-deepseek-v4-flash-thinking-pill.md`.

## 6. S1–S4

```
mcp-server/vault.js
mcp-server/agent-instructions.js
mcp-server/vault.security.test.js
src/lib/sensitiveTextRedaction.ts
src/lib/sensitiveTextRedaction.test.ts
src/lib/feedbackDiagnostics.ts
src/lib/feedbackDiagnostics.test.ts
src/lib/telemetry.ts
src/lib/telemetry.test.ts
docs/plans/s-plans/2026-09-14-security-audit/README.md
```

## 8. Dep pins

```
pnpm-workspace.yaml
mcp-server/package.json
pnpm-lock.yaml
```

## Stop

No push. No `/Applications` rebuild. No `--no-verify`.
