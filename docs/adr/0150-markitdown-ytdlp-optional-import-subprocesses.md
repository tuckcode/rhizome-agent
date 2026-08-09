---
type: ADR
id: "0150"
title: "markitdown and yt-dlp as optional Import-tab conversion subprocesses"
status: active
date: 2026-07-09
---

## Context

`2026-07-05-one-brain-architecture-decision.md` named `markitdown` document
conversion as "the one justified subprocess" surviving the One Brain
absorption — "a deep ecosystem problem Python genuinely wins... file in →
markdown out... optional dependency of the Import tab." That decision named
the tool but never wired it into `rhizome-desktop`; today's Import tab still
shells the whole `rhizome-import-source` Python CLI, which itself handles
file conversion, URL fetching, and YouTube transcript extraction internally
in ways not vendored into this repo.

Rebuilding `rhizome_import_source` on the agent layer (step 4b) needs an
equivalent for all three source types the UI already advertises (PDF/URL/
Text buttons in `ResearchPanel.tsx`): local/dropped files, generic URLs, and
YouTube videos. `markitdown`'s CLI contract is narrower than that ("file in
→ markdown out", confirmed via `markitdown --help`: takes a filename or
stdin, no URL fetching of its own) — it does not cover URL fetching or
YouTube transcripts by itself.

## Decision

**Add `markitdown` and `yt-dlp` as optional, PATH-discovered subprocesses of
the Import tab, same posture as the CLI-agent adapters** (checked via
`cli_agent_runtime::find_cli_binary`, gracefully unavailable rather than a
hard dependency):

- **Local/dropped files**: `.md`/`.markdown`/`.txt` read directly
  (`std::fs::read_to_string`); everything else shells `markitdown <path>`.
- **Generic URLs**: fetched with `reqwest` (already a dependency), written
  to a temp file with an extension guessed from the response
  `Content-Type`, then piped through `markitdown` — matching its file-in
  contract rather than guessing at raw-HTML stdin handling.
- **YouTube URLs** (`youtube.com`/`youtu.be` hosts): `yt-dlp --skip-download
  --write-auto-sub --sub-format vtt` to fetch auto-generated captions, then
  a small VTT→plain-text parser (strip cue timing/numbering, dedupe
  consecutive repeated lines — a known auto-sub artifact).

Both tools are checked for availability the same way the old
`rhizome_check_availability` checked the Python toolkit: missing means a
clear per-source error, not a crash, and (per step 4b's UI wiring) disables
only the affected source type rather than the whole Import tab.

## Options considered

- **Enable `WebFetch`/`WebSearch` for the agent instead of Rust-side
  fetching**: rejected — those tools are explicitly disallowed for both
  Safe and PowerUser permission modes today
  (`claude_invocation.rs::CLAUDE_SAFE_DISALLOWED_TOOLS_COMPAT` /
  `..._POWER_USER_..._COMPAT`), and loosening that for research/distill/
  import specifically is a permission-model change with its own blast
  radius (every future prompt through this path would gain live web
  access), not a narrow fetch. Rust-side `reqwest` is a bounded fetch this
  one wrapper controls directly.
- **Vendor/bundle markitdown and yt-dlp with the app**: rejected for now —
  both are Python-ecosystem tools with their own runtime/model
  dependencies (`markitdown` pulls in document-format libraries; `yt-dlp`
  needs regular updates to track site changes). Matches the original
  decision's "optional dependency" framing rather than "always-available."
  Bundling can be revisited if users hit availability friction in practice.
- **Skip YouTube entirely**: rejected — the UI already advertises URL
  import and YouTube is a common source class; users of the real vault
  research workflow use it today via the Python CLI. Deferring it would be
  a silent feature regression, not a scope cut.

## Consequences

- Import gains two new optional runtime dependencies beyond the CLI-agent
  adapters already optional. Neither is bundled; both degrade gracefully
  per source type when absent.
- `yt-dlp`'s reliance on scraping YouTube's page structure is inherently
  more fragile than a stable API — auto-sub availability and format can
  change upstream. Treated as best-effort, matching the CLI-agent
  adapters' own "not always available" posture.
- If bundling ever becomes necessary (e.g. for a signed, dependency-free
  release), it's a new packaging decision or its own ADR — this one only
  covers "the app can use them if present."
