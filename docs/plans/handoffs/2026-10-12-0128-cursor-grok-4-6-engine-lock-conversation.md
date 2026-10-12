---
session: 2026-10-12-0128
model: Cursor Grok 4.6
description: #158 — lock engine on Chat conversation id; Settings flip applies to next chat
---

**Origin:** Cursor Grok 4.6 · 2026-10-12 · Ricky + Critiquito review of #158

## What was true

The engine lock keyed `conversation` on Prime's session path. A mid-chat
host dropout (update, restart) nulls that path, the lock stops matching,
and the open chat falls through to Rhizome's engine and loses Prime
history. The older ChatHome test kept the mock session id, so it never
caught this.

The lock also matched Settings `requestedEngine`. Flipping the Chat
engine switch changed the open chat's engine — same history-loss class.

## What changed

- Lock conversation is ChatHome's own id (`newChatConversationId`), not
  `primeHost.sessionPath` / `sessionId`. New Chat and session pick still
  clear the lock and mint a new id.
- `startedEngineFromLock` matches conversation + target only. A Settings
  flip does not unlock the open chat. The new value applies on New Chat.
- Prime chrome follows the effective engine so an open Prime chat keeps
  New Chat after a Settings flip.
- Settings copy is unchanged except one added line: "Changes apply to
  new chats." Source: `settings.chatEngine.description` in `en.json`.
  Other locales fall back to English.

## Tests

- Host session path/id go null mid-chat → stays Prime.
- Open Prime chat, flip Settings to native → stays Prime; New Chat is
  native.
