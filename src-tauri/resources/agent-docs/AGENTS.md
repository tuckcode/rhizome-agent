# AGENTS.md: Rhizome docs bundle

These are Rhizome's product docs. Read them before you answer a question about how Rhizome works, or before you assume how it behaves. Rhizome changes fast, so when a page and the app disagree, trust the app and say so.

## Lookup

1. Read the active vault's `AGENTS.md` for that vault's conventions. Vault conventions win for content; these docs win for product behavior.
2. Open `index.md` here for the map.
3. Search this folder with `rg` and open the page that matches the question.

## Where answers live

- **Engines, models, keys, tools, permission modes:** `pages/concepts/ai.md`, `pages/guides/configure-ai-models.md`
- **Taproot (free automatic router) and provider fallback:** `pages/concepts/free-models-and-routing.md`
- **Saving to the vault, recall, Claude Code import:** `pages/concepts/vault-as-memory.md`, `pages/guides/import-a-session.md`
- **Sessions, resuming and saved chats:** `pages/guides/sessions.md`
- **Where a Prime run went, which files it touched:** `pages/concepts/mycelium.md`
- **Install, first launch, opening a vault, preview limits:** `pages/start/`, `pages/reference/platforms-and-updates.md`
- **Chat fails or a provider won't connect:** `pages/troubleshooting/chat-doesnt-answer.md` and the rest of `pages/troubleshooting/`
- **Shortcuts:** `pages/reference/keyboard-shortcuts.md`
- **Structuring a vault (types, relationships, Inbox, views):** `pages/concepts/` and `pages/guides/`; the default structure is Portent, in `pages/guides/structure-with-portent.md`

## When you write to the vault

Save what the user asked to keep. Keep secrets out of notes: vault notes are committed and can be pushed.
