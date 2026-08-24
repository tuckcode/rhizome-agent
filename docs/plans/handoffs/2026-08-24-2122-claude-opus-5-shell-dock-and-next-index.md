---
session: 2026-08-24T21:22Z
model: Claude Opus 5
description: >-
  Note tree docked right and ADR-0166 written for the chat-centred shell, with
  three questions left open. An attempt at tree/list exclusivity was reverted —
  it broke Cmd+N, inbox auto-advance and note selection. Also: stale
  Tolaria/Desktop naming fixed in six live docs, the Linux/Windows menu bar now
  tracks the pointer, a scheduled security review found nothing above the bar,
  and docs/NEXT.md now indexes unclaimed work.
commits: a9ec6b8..760f63c, b8dc8fb
---

# Shell dock, ADR-0166, and a next-work index

Two clusters of commits, interleaved with other agents' work — see
`git log --format='%h %s %(trailers:key=Co-Authored-By,valueonly)'` to
separate them.

## The shell moved right

`a9ec6b8` `ResizeHandle` takes `edge="trailing"`: a right-docked panel grows
when the pointer moves *left*, so the raw drag delta is backwards there. The
prop inverts it and flips the negative margin.

`43008f4` The note tree docks right, gated on `shell_command_rail`. The rail
owns the left edge — it is what reserves the macOS traffic-light gutter — so
with the classic shell (`ff_shell_command_rail=false`) the tree stays where it
was. Docked right it drops the 90px inset from its title bar, mirrors the
collapse glyph, and moves its divider to the leading edge.

Verified in the browser at 1440×900: DOM order `rail | note-list | editor |
sidebar--right`, drag-left grew it 250→330px, collapse/expand round-trips,
seams checked with computed styles.

## ADR-0166, and what it did not settle

`8a6d582` ADR-0166 records the chat-centred shell — Chat as permanent centre,
one panel per side — and supersedes `shell-final-direction.md` §2.1 (region
map) and §2.3 (sidebar position). **Only those two sections.** The status-bar,
graph-chrome, settings and token sections still stand; both superseded sections
now carry a pointer so a fresh session does not build toward the old map.

Three questions are open in that ADR and they block five issues. `docs/NEXT.md`
§1 has the list.

## The exclusivity attempt, and why it was reverted

`64b2e89` **Negative result worth not repeating.** The annotated design feedback
was "never are both open" for the tree and note list once they share the right
slot. Making view mode `all` resolve to tree-only looked like the cheap way to
get there, reusing the existing collapse/expand buttons as the switch.

It broke the app. `App.test.tsx` failed on `persists a Cmd+N note before opening
it`, `auto-advances to the next inbox item after organizing`, and four more —
because the note list is not decoration alongside the tree, it is how notes get
opened, and real flows assume it is visible on load.

What landed instead is the safe half: `noteListPanel` extracted as its own JSX
const, mirroring `sidebarPanel`. Verified behaviour-neutral — 541 files / 5672
tests before and after, same counts, and a throwaway DOM-order probe confirmed
the default shell is unchanged.

**Real exclusivity needs a control the user opts into, not a changed default.**
Two undecided ideas are in play: split the centre horizontally (editor on top,
Chat as a collapsible bottom strip), or one shared side panel where clicking a
note turns the list into the editor.

## Docs: stale naming in live guidance

`911435a` A sweep found 118 files mentioning Tolaria and 41 mentioning grok.
Most are correctly historical — ADRs (never edited after the fact, by repo
rule), dated session logs, and comparative design-doc language describing what
the UI is moving *away from*. Those were left alone.

Six were live guidance actively misnaming the product, which is the risk the
STOP block in `AGENTS.md` exists to prevent:

- `ARCHITECTURE.md` / `ABSTRACTIONS.md` opened with "Tolaria is…" in present
  tense, no disclaimer, both required reading. `ARCHITECTURE.md` also named
  seven component files by their pre-rename names — verified all seven do not
  exist, corrected to their `rhizome*` names.
- `GETTING-STARTED.md` called itself "the Rhizome **Desktop** codebase" — the
  wrong sibling repo, contradicting `IDENTITY.md`.
- The two `grok-wiki-*` docs said "reference for Rhizome Desktop's research
  features", but they are the live reference for *this* repo's `ResearchPanel`
  and `rhizome_grok_import`. Relabelled, content kept.
- `architecture-2026-06-30.md` got a historical note pointing at
  `ARCHITECTURE.md` and ADR-0166.

Deleted `needs-review.md`: a three-item fork-bootstrap leftover from
2026-08-09, referenced by no required reading, whose one checkable item was
already resolved.

## Menu bar tracks the pointer

`760f63c` `HorizontalMenuBar` gave every section its own `DropdownMenu` root, so
the bar had no idea it was a bar: sliding from an open File onto Edit did
nothing, and a trigger went flat the moment the pointer entered its own
dropdown. One shared open-label now drives the bar; hover *steers* an open bar
but never opens one.

Controlling `open` exposed an ordering race the independent roots hid — clicking
Edit while File is open fires both Edit's open and File's dismiss in no
guaranteed order. A close now only clears the bar when that section is still the
open one. The pre-existing adjacent-tab test caught it.

**Scope: Linux and Windows only** (`shouldUseCustomWindowChrome()`). macOS uses
the native menu bar, where the OS already does both behaviours.

## Security review (scheduled)

Ran against `aed471b`. **No findings above the medium bar**, nothing posted.
Traced: the vault path boundary, MCP server path handling (including symlink
parent escape), process execution, XSS sinks, CSP, deep links, the WS bridges,
secrets-at-rest, and the updater. The codebase held up.

Two notes for whoever runs this next:

- **The routine's tooling is not wired up here.** No automation-memory tool and
  no Slack tool are exposed, so the flagged-vulnerability memory family could
  not be read or written and findings had nowhere to post. Wire both before
  relying on the recurring run.
- One real defect was reported below the bar: `delete_vault_folder` /
  `rename_vault_folder` never verified `vault_path` was a *registered* vault,
  so they skipped the `VaultBoundary` check every note command goes through.
  Not filed as a vulnerability because Tauri IPC is only reachable from the
  app's own webview and no XSS was found to get there. **GPT-5.6 Sol fixed it
  independently in `2d12ca5`.**

## Recovered another session's work

`aed471b` is **GPT-5.6 Luna's** handoff, not mine — it was sitting uncommitted
in the working tree from before this session, carrying C43/C44. Committed under
its own `Co-Authored-By` so the provenance stays right. Check `git status` for
orphaned work before starting; it had been stranded across at least one session
boundary.

## docs/NEXT.md

`b8dc8fb` An agent finishing its handoff task had nowhere to look for the next
one — `HANDOFF.md` refuses to carry a backlog by design, the tracker has 27
unordered issues, and the C-numbers live in a third place.

`NEXT.md` indexes all three: issues by theme with blocked ones marked, the 16
open C-numbers by kind, the decisions that gate them, and where design docs need
filling. Two findings recorded there:

- **No design doc or ADR references any issue number** — verified across all of
  `docs/design/` and `docs/adr/`. ADR-0166's open questions are silently
  blocking #27, #34, #39, #11 and #22 with nothing on either side saying so.
- **#40 reads as answered by ADR-0168** ("absorbs metabolites, not organs") but
  is still open and `needs-info`.

It also flags that C-numbers and issue numbers collide with different meanings —
C40 is `rhizome_graph_summary`, #40 is the harness question.
