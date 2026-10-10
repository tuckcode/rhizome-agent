---
session: 2026-10-10T18:00Z
model: Grok 4.6
description: >-
  Step 1a: create_note is a real native-loop tool. Limited tools
  asks every call; Power User runs it. Chat stays on Prime.
commits: 38aedf5..HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 18:00 UTC

## What landed

Step 1a on `main` after #109 and #110. Did not edit `HANDOFF.md`.
Did not start 2c, the Settings toggle, or Claude's 1b/1c/routing/keychain.

- `policy`: both modes offer `create_note`. Limited tools `Ask` every
  call. Power User `Run`. `session_matches` is false, so a session
  grant never skips the ask. AllowSession does not store a grant.
- `tools::execute_allowed` dispatches by name. `create_note` calls
  `run_create_note_tool(raw_args, vault_path, vault_paths)`. Helper
  errors become `ToolResult` text.
- Vault lives on the loop run context (`set_vault`). Not on `ModelView`.
- #110 review: `ai_model_tools` and `CREATE_NOTE_TOOL_NAME` are
  `pub(crate)`. Helper tests cover `/tmp/x.md` and no vault.

## Tests

Red `38aedf5`. Green this commit. Loop 43, including ask-before-write,
deny writes nothing, allow writes the note.
