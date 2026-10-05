---
session: 2026-10-05T03:25Z
model: Grok 4.6 (Cursor)
description: >-
  First #23 slice: app search still indexes session transcripts, and a hit now
  opens that session at the transcript message index. On-disk index and real-log
  dogfood remain.
commits: 0107b23
---

# #23 first slice — open a transcript hit at that point

**Origin:** Grok 4.6 (Cursor) · 2026-10-05 · issue #23

## Why

In-memory transcript search already listed hits in `SearchPanel`. Choosing a
hit did not move the live chat. The Sept 30 plan named that as the leftover
product slice.

## What changed

- App search still shows a Sessions group (user turns and assistant prose).
- Choosing a hit closes search, returns to Chat, switches the Prime session,
  and scrolls the matching transcript item into view.
- `session_transcript_hit_opened` records the role only. No query, path, or
  excerpt.
- `import_jsonl` was not touched. No new Tauri command. The #23 commits did
  not edit `prime_sessions.rs`; the branch later merged #77 so a missing
  sessions dir is a refuse. Laputa/Tolaria paths were not edited (#57).
- Hit highlight/scroll lives in `TranscriptHitAnchor` and
  `useScrollToTranscriptHit`, not inlined in `AiMessage` / `AiPanelChrome`.

## Still open for #23

- An on-disk incremental index (this slice stays in memory, keyed by path +
  `mtimeMs`).
- Dogfood against real `~/.prime/agent/sessions/*.jsonl` on a machine that
  has them. This cloud checkout had an empty sessions directory.
- Keyboard move through session hits in the search list (mouse works).
