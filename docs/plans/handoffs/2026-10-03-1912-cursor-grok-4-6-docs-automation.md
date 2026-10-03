---
session: 2026-10-03T19:12Z
model: Cursor Grok 4.6
description: >-
  Weekly docs automation synced living pages to Wave 3 source: transcript
  search, timezone, chat profile, queue mutate, event-log cap, live-prime
  isolation, and Apple Silicon alpha DMG. No product code.
commits: ff9909a..HEAD
---

# 2026-10-03 · Wave 3 living-docs sync

**Origin:** Cursor Grok 4.6 · 2026-10-03 · cron documentation automation.

## State

- `origin/main` at start = **`ff9909a`**. Installed app remains **`d0a55f8`**.
- Last docs-automation memory was 2026-09-26 against tip `835c5bb`.
- Wave 3 source landed on `main` after that memory. Living pages still
  called several of those ships parked or unspoken.

## What this session verified (source, not GitHub close)

| Ship | Codepath | Leftover |
|---|---|---|
| #23 transcript search | `sessionTranscriptSearch.ts`, `useSessionTranscriptSearch.ts`, `SearchPanel` | `App.tsx` does not pass `onSelectSessionHit` |
| #36 timezone | `settings.timezone`, `dateDisplay.ts`, Vault content picker | Display-only; stored dates unchanged |
| C66 profile | `settings.agent_profile`, `compose_agent_profile` | Not per-agent / per-vault |
| #41 mutate | `mutate_prime_queued_message` → `mutate_queued_message` | Native Enter-queue / Steer evidence |
| C75 rail | `SESSION_LIST_WINDOW = 24` | Full transcript remount still separate |
| Event log cap | `EVENTS_JSONL_MAX_BYTES` 1 MiB → `events.jsonl.1` | Reader still newest 200 lines |
| C53 (b) | `worker-failed:` without the 30s wait | Connect probe still 30s |
| Live-prime isolation | `RHIZOME_PRIME_DAEMON_SOCKET` + `RHIZOME_PRIME_SESSION_DIR` | `#[ignore]` still says `RHIZOME_TEST_DAEMON_SOCKET` |
| Rust Sentry | `ghr_` / `sk_live_` / `sk_test_` in `scrub_secrets` | Older notes said JS-only |
| Alpha macOS | aarch64 + Silicon DMG | Intel dropped (`ort-sys`) |

## Pages updated

`ARCHITECTURE.md`, `YOU-SHOULD-KNOW.md`, `GETTING-STARTED.md`,
`CROSS-MODEL-HANDOFF.md` (§26–§27), `ABSTRACTIONS.md` release lines,
`HANDOFF.md` / `NEXT.md` / `BOARD.md` tip hashes, `AGENTS.md` live-prime
env names.

## Not done

- No GitHub issue closes (close-on-live-check).
- No `/Applications` rebuild.
- No new ADR (no new dependency or storage strategy).
