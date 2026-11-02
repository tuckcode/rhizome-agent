---
session: 2026-11-01T20:30-06:00
model: Claude Opus 5.5 (Claude Code)
description: >-
  The installed app binary is Rhizome through mainBinaryName. The Cargo binary
  stays RhizomeAgent, and the bundle id and keychain service do not change.
---

# App binary name

**Origin:** Claude Opus 5.5 · 2026-11-01 · app binary rename

`bundle` output now has `Contents/MacOS/Rhizome`. The Cargo binary name stays
`RhizomeAgent`, because `docs/IDENTITY.md` records a `Rhizome` collision with
Rhizome Desktop on PATH. `ai.rhizome.agent`, `com.rhizome.app`, and the
keychain service do not change.

Older Prime code and tests still name `Rhizome Agent.app`. That code leaves
with the ADR-0189 removal work.
