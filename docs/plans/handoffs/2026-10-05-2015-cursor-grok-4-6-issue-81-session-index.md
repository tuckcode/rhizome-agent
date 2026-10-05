---
session: 2026-10-05T20:15Z
model: Grok 4.6 (Cursor)
description: >-
  #81 first slice: on-disk session-transcript index, Prime jsonl fixtures,
  and keyboard move through the Sessions search group. Rhizome-owned
  memory (ADR-0177). Did not close #81.
commits: e17d074..20883c8
---

# #81 — on-disk session index, fixtures, Sessions keyboard

**Origin:** Cursor Grok 4.6 · 2026-10-05 · issue #81

## Why

#79 opened a search hit at the transcript message. The leftover work was
an in-memory index that re-read each log per path + `mtimeMs`, empty-box
CI with no `~/.prime/agent/sessions` logs, and arrow keys that stopped
at note rows.

## What changed

- The TypeScript index hydrates extracted turns from a Rhizome cache
  file and skips `read_prime_session_transcript` when the list stamp
  still matches. Prime's session directory is not written.
- Host commands `load_session_transcript_index` /
  `save_session_transcript_index` store
  `ai.rhizome.agent/session-transcript-index/v1.json` (or
  `$RHIZOME_CACHE_DIR/session-transcript-index/v1.json` in tests).
- Shipped a real-shaped Prime jsonl fixture plus
  `primeTranscriptItemsFromJsonl` so CI can index a log without Prime.
- Arrow keys and Enter move through the Sessions group with note
  results.

## Still open on #81

Nothing from the three checkboxes is left in this slice. A later harness
(Hermes) can feed the same store; that wiring is not in this PR. Live
dogfood against a machine that already has `~/.prime/agent/sessions`
logs is still worth a native pass.

## Left alone

- Hermes ACP (`hermes_cli`, `acp`).
- `prime_sessions.rs` parse / daemon-stop tests (#80).
- `import_jsonl`.
