---
session: 2026-08-29T02:05-05:00
model: Grok 4.6 (Cursor)
description: Prime always power user; Limited tools label for CLI agents.
---

# Prime permission mode — 2026-08-29

**Origin:** Grok 4.6 (Cursor) · 2026-08-29

Claude recommended options 1+2 on the Vault Safe / Power User question in the 01:00 session. Atticus delegated. No sandbox was added (AGENTS.md).

## Shipped

- Prime always resolves to **Power User**, including vaults that still store `safe`. Existing installs were stuck: the prompt said “Do not use shell…” and the model obeyed, with nothing behind it.
- CLI agents (Claude Code, Antigravity, Codex, …) still use the stored vault mode. Default remains `safe`. Enforcement adapters were not touched.
- Copy: CLI **Limited tools** (not “Vault Safe”). Prime-specific keys exist (**Notes first** / **Full tools**) for instruction-only wording. The Prime toggle stays hidden — showing a control `resolvePermissionModeForAgent` ignores would be a lie.
- Prime system prompt always: full tools, plus “Prime has no sandbox — these are instructions, not enforced limits.”

## Remaining (C57)

Awaiting Atticus: CLI default stay Limited tools? keep the Prime toggle hidden? keep “Limited tools” vs restore “Vault Safe” with an honest tooltip.
