---
session: 2026-10-17T19:04Z
model: Cursor Grok 4.6
description: >-
  Docs only: Chat default is native, vault file tools and bash are real,
  Packages marketplace is gone, Kanban park lifted with no board yet.
commits: HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-17 · weekly docs automation

Living developer docs and Starlight still said Chat starts on Prime,
native tools cannot search the vault, `bash` does not run, and Settings
has a Packages hub. Source on `4e9b2ecb` disagrees.

## What landed

Docs only. No product code.

Verified against:

- `src/lib/chatEngine.ts` — absent `chat_engine` is native
- `src/lib/effectiveChatEngine.ts` — Prime-missing fallback after host status
- `src-tauri/src/rhizome_loop/tools/mod.rs` and `policy.rs` — tool registry
- `src-tauri/src/rhizome_loop/tools/shell.rs` — bash runs in the vault root
- `src/components/SettingsPanel.tsx` — no Browse packages; Advanced Prime engine
- `src/lib/notesPanelMode.ts` — Auto / Rail / Open
- `src/lib/themeMode.ts` — Graphite is the default color theme
- ADR-0187 and ADR-0188

Pages updated: README, GETTING-STARTED, PUBLIC-PREVIEW, YOU-SHOULD-KNOW,
ARCHITECTURE (engine default), IDENTITY, CROSS-MODEL-HANDOFF §20 and §27,
NEXT parked Kanban row, docs/start, docs/for-agents, and Starlight
concepts/guides/start/troubleshooting.

## Not in this change

No picker removal (ADR-0187 still has `ChatEngineSettings` in the tree).
No Kanban UI. Mutate tools still ask in Power User; that mismatch with
ADR-0187 is named in YOU-SHOULD-KNOW, not "fixed" in the ADR.
