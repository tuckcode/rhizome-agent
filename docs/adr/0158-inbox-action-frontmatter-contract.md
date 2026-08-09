---
type: ADR
id: "0158"
title: "inbox_action frontmatter: a capture declares its own routing"
status: active
date: 2026-07-25
---

## Context

Everything that lands in `<vault>/raw/inbox/` is routed by
`inbox_watcher::classify_inbox_file`, which guesses from the file extension
and, for `.txt`, from whether the whole file is a bare URL:

| Input | Routed to |
|---|---|
| `.md`, prose `.txt` | Distill (agent call → Concept card) |
| bare-URL `.txt` | Import (fetch the URL → Document) |
| anything else | Import (markitdown conversion → Document) |

That heuristic works for a human dragging a file in, because the file is all
the information there is. It breaks for the browser extension
(`docs/plans/2026-07-25-browser-extension-plan.md`), whose popup offers two
*different* things to do with the *same* page:

- **Save URL** — "this page as a link." Store it. Don't spend tokens.
- **Distill this page** — pull the article text through `rhizome_distill`.

Both would arrive as the same kind of file, so the heuristic cannot tell
them apart. Worse, there was no save-only lane at all: every inbox drop ran
an AI verb, so "just save this link" was not expressible. A bare-URL `.txt`
looks like the closest fit and is exactly wrong — it triggers a full fetch
and agent-structured Import.

The intent lives with the caller, at capture time. It needs somewhere to
travel.

## Decision

**A file dropped in `raw/inbox/` may declare its own routing in an
`inbox_action:` frontmatter key; a declared action always beats the
extension heuristic, and an absent or unrecognised value falls back to it.**

```yaml
---
title: Idempotency Explained
inbox_action: save          # save | distill | import
source_url: https://example.com/idempotency
---
```

New module `src-tauri/src/inbox_action.rs` owns the contract:

- `InboxAction { Save, Distill, Import }` — parsed case-insensitively from
  the declared value; `from_declared` returns `Option`, so an unknown value
  is a fall-through, never a guess.
- `declared_inbox_action_in_file(path)` — only `.md`/`.markdown` is read.
  A `.txt` or PDF has no frontmatter to declare, and a PDF isn't UTF-8.
- `save_captured_file(vault, file, trigger)` — the save-only lane.

`InboxAction` **replaces** `inbox_watcher::InboxKind` rather than sitting
beside it. `InboxKind` was "which agent verb runs"; the routing decision is
now "what happens to this file," of which "no agent verb runs" is a legal
answer. Two overlapping enums for one decision would drift.

### The save lane

`save_captured_file` files the capture as a `Document` artifact —
`wiki/sources/documents/<slug>.md` — by reusing
`rhizome_import::write_imported_document` and `import_frontmatter`. A saved
page *is* a source document; it just skipped the agent.

The capture's frontmatter is **read, never copied through**. The filed page
gets contract frontmatter (`title`/`type: source`/`state`/`last_updated`/
`context`/`source`), so `inbox_action:` — an instruction to the inbox, not
content — never reaches the vault. `source_url:` (what a browser capture
sends) or `source:` becomes the page's `source:`; title falls back to the
file stem; body is the capture minus its frontmatter.

It logs a `type: "capture"` line to `.rhizome/events.jsonl` — the event type
menu-bar capture already uses for "landed without an agent" — carrying the
caller's `trigger` verbatim, so a browser save is attributable end to end
once commits 4–7 wire `trigger: "browser_extension"` through the bridge.

## Options considered

- **`inbox_action` frontmatter** (chosen): the intent rides with the file,
  so it survives being written to disk by one process and read by another —
  which is exactly the extension → `raw/inbox/` → watcher hop. Costs one
  frontmatter read per markdown drop. Human-visible and human-editable: you
  can retype `distill` in a file that saved and re-drop it.
- **Filename convention** (`*.save.md`): no parse cost, but encodes
  semantics in a string nothing validates, collides with
  `move_to_processed`'s dedupe suffixing, and is invisible once the file is
  open.
- **Sidecar file** (`page.md` + `page.action`): keeps the capture pristine,
  but doubles every filesystem event the watcher must debounce and creates
  an orphan whenever one of the pair fails to write.
- **Extra argument on the bridge verb, no on-disk contract**: simplest for
  the extension, but only the extension could ever express intent —
  inbox-watcher drops, menu-bar captures, and a human dropping a file are
  all locked out. The whole point is that intent must survive the disk hop.

## Consequences

**Easier.** Any producer can now say "save, don't distill" without a new
verb: the browser extension, the menu-bar screenshot capture (which
currently writes into `raw/inbox/` and gets distilled whether that makes
sense or not), or a human writing the key by hand. Save-only costs zero
tokens, which matters for the extension's most common action.

**Harder.** There is now a second way to route a file, so a confusing route
has two candidate explanations (heuristic vs. declaration). The
`declared beats heuristic, unknown falls back` rule is the fixed tiebreak,
and it is tested in both directions.

**Cost.** Every markdown drop is read and frontmatter-parsed once before
routing — for a file that is about to be read in full and sent to an agent
anyway, this is noise.

**Not decided here.** Whether the extension writes into `raw/inbox/` at all
or calls a bridge verb directly is commits 4–7's decision; this contract
serves both, because `save_captured_file` takes a `trigger` and does not
care who called it. Deduplicating a page saved twice is also out of scope —
the second save lands as `<slug>-2.md`, matching how every other artifact
writer already behaves.

**Re-evaluate if** a fourth action appears that isn't "file it" or "run a
verb on it" (e.g. "queue for review"), or if non-markdown captures need to
declare an action — today only `.md` can, by design.
