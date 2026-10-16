---
title: Your vault is the agent's memory
description: How the agent's memory lives in your vault, and how you save, recall and revert it.
---

The agent's long-term memory is your vault: a folder of Markdown files you can read, edit, search and version yourself. Nothing the agent "knows" between chats is hidden from you.

## What you get

- **You decide what's remembered.** Knowledge reaches the vault when you save it, not as a side effect of every chat.
- **Recall shows its source.** When an optional Prime answer uses a vault note, it's marked **From your vault**, so you can open the note and check. Rhizome's own engine can't search the vault yet.
- **Memory is reversible.** In a Git-backed vault, every saved or edited note is a change you can diff and revert.
- **Memory is portable.** It's plain Markdown. Open it in another editor, sync it with Git, or keep it if you stop using Rhizome.

## The memory loop

1. **Chat.** You and the agent work on something. Chat transcripts are working memory. They live with the session, not in the vault.
2. **Save.** Under a reply worth keeping, click **Save to vault**. Rhizome writes a Markdown note.
3. **Recall.** Rhizome's own engine can't read or search the vault yet. If you use Prime as an optional engine, that engine can search and open vault notes in later chats, and an answer built on a note shows it came from your vault.
4. **Review.** Open, edit or delete the note like any other. With Git, look at its history and revert a change.

## Save to vault

**Save to vault** appears under a reply. It writes the note straight away. There's no preview or diff step, so review the note afterwards, or use Git to undo it.

It refuses to save when:

- **The reply is empty.** There's nothing to save.
- **No vault is attached** to the chat. It says "Attach a vault to save chat into notes".
- **The text contains a credential**, such as an API key or password. Vault notes are committed and can be pushed, so remove the secret first.
- **The same reply is already in the vault.** It names the existing note and doesn't overwrite it.

### Automatic saves are off by default

Settings → AI Agents → **Auto-save chat knowledge to the vault** saves durable decisions to the vault after each turn. It's off by default. Turn it on only if you want saves to happen without a click. Explicit saves are easier to trust.

## Bring in past chats

You can import your Claude Code chat history from Settings → AI Agents → **Import chat history**. Rhizome scans `~/.claude/projects` on your Mac. The chats become notes under `Imports/claude-code/` in the vault. A second import skips chats that are already there. Claude Code is the only source today.

## Why Git matters here

Git turns the vault into memory with a history:

- **Diff:** see what a note said before the agent or you changed it.
- **Revert:** undo one change without touching the rest.
- **Sync:** push the vault to a remote you control. Rhizome uses your system Git login.

Git is optional. A plain folder works, but it has no history to go back to. See [Git](git.md).

## What the agent reads first

A vault can hold an `AGENTS.md` file with your conventions: how notes are named, which types to use, what to avoid. The agent reads it before it works in the vault. `CLAUDE.md` is kept as a compatibility copy for tools that look for that name.

## Where things live

| What | Kept in | You can |
|---|---|---|
| Saved notes | The vault | Read, edit, diff, revert, sync |
| Imported Claude Code chats | `Imports/claude-code/` in the vault | Read, edit, link |
| Chat transcripts (Prime) | `~/.prime/agent/sessions/` | Resume from the sessions list |
| Chat transcripts (Rhizome's engine) | `native-sessions/` in the app config folder | Resume from the sessions list |
| Vault activity log | `.rhizome/events.jsonl` in the vault | Inspect |

## Related

- [Mycelium](mycelium.md): see which files a Prime run touched.
- [Vaults](vaults.md) · [Git](git.md) · [Chat with the agent](../guides/use-ai-panel.md)
