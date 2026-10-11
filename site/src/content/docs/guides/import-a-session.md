---
title: Import Claude Code history
description: Bring your Claude Code chats into the vault as Markdown notes.
---

Bring your past Claude Code chats into the vault, so what you worked out there becomes notes you can search, link and keep.

## Import

1. Open the vault you want the chats in.
2. Open Settings → AI Agents → **Import chat history**.
3. Under **Claude Code**, preview what Rhizome found, then run the import.

Rhizome scans `~/.claude/projects` on your Mac. Each chat becomes a note under `Imports/claude-code/` in the vault.

## Run it again

A second import skips chats that are already in the vault, so you can run it whenever you've done more work in Claude Code.

## Limits

- Claude Code is the only source today. Cursor and other tools aren't wired yet.
- Imported chats are notes, not sessions. You read and link them; you don't continue them in Chat.

## Related

- [Your vault is the agent's memory](../concepts/vault-as-memory.md)
- [Coming from another harness](coming-from-other-harnesses.md)
