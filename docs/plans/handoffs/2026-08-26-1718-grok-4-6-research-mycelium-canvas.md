---
session: 2026-08-26T17:18-05:00
model: Grok 4.6 (Cursor)
description: >-
  Research as a rail canvas; Mycelium #11/#22 in-app sidecar embed with
  Rhizome chrome. #24 promote is in the same dirty tree. Live check leftover.
commits: 5d2d34a, 80fa720
---

# Research canvas + Mycelium in-app — stop here 2026-08-26 afternoon

**Later the same day:** this slice was committed and pushed (`5d2d34a`,
gate fix `80fa720`). The “dirty tree” line below is historical.

Do not close #11 / #22 / #24 on GitHub until the user live-checks.
Do not start TokenJuice/Switchyard or harness composition. Do not run
`pnpm l10n:translate` (C18).

## What is true in the working tree

Research and Mycelium take the **center canvas**, same family as Graph.
They are not app-level modals. Rail Chat / ⌘1 leave them.

```
rail | sessions | CHAT or Graph or Mycelium or Research | Notes (optional)
```

- **Research:** `ResearchPanel` `variant="pane"` in `App.tsx`. No Chat
  overlay inside it (no second conversation). Dialog variant remains for
  tests; destination-confirm is still a small dialog. Close / rail Chat / ⌘1
  return.
- **Mycelium #11:** `mindwalk serve|open --no-open` as a local sidecar;
  view is an iframe at `127.0.0.1`. PATH empty-state gone. Sidecar miss =
  Retry. CSP `frame-src` allows loopback.
- **Mycelium #22:** Rhizome chrome (header, overview list vs this-session,
  Retry/Close). Rail = all sessions. In-session **This run**
  (`prime-session-footprint`) = this session only. Footer: Mindwalk (MIT)
  © 2026 Ricko Yu. Engine is **not** restyled — lipstick is chrome only.
- **M4 (not started):** skin a Rhizome citymap client against Mindwalk's
  JSON/`schema/` so engine bumps keep the lipstick. Iframe CSS is not that.
- **#24 Promote (same dirty tree):** `raw/inbox/{YYYYMMDD}-{slug}.md`;
  title from heading/first sentence, never a raw timestamp; frontmatter
  `title`, `is_a: Note`, `created`, `source: prime-chat-promote`, `session`
  when Chat can pass it. Same-path refuse + toast. #29 credential check
  still first.

## Live check leftover (user)

1. Promote one real Chat turn (#24).
2. Research rail, then Chat / ⌘1 back.
3. Mycelium rail (overview) and **This run** (this session), if Mindwalk
   is installed.

## Do not

- Commit unless asked (commit = local save; push = GitHub).
- Close #11 / #22 / #24 without the live check.
- Absorb/fork Mindwalk this pass.
- Start TokenJuice / Switchyard / harness composition.
- Put `data-tauri-drag-region` back on breadcrumb/subhead.

## Pickup

New session is cheaper than continuing this compacted thread. Read this
file + `git status`. Tests already green for Research/Mycelium frontend
and `cargo test mycelium`.
