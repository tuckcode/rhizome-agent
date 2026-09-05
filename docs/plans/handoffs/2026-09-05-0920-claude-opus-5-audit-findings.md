---
session: 2026-09-05T09:20:00-05:00
model: Claude Opus 5
also: [Claude Sonnet 5 (C60 source investigation)]
description: >-
  Fixed C62 (duplicate row after rename), C64 (false "Prime not installed"
  flash) and C63 (one-node graph over-zoom); found and mitigated the leading
  mechanism for C60's blank window. No native verification of any of it.
---

# Native-audit findings C60–C64

The four defects GPT-6's native journey audit left open. Three are fixed at
source with regressions; C60 has a mechanism and a mitigation but no proof.

## C62 — duplicate Inbox row after automatic rename

**Fixed on the second attempt. The first attempt was wrong, and the way it was
wrong is the most useful thing in this handoff.**

A just-created note is protected from being dropped by a stale reload snapshot:
`addEntry` tracks it in `newPathsRef`/`newEntriesRef`, and
`reconcileReloadedEntries` re-appends any tracked note the fresh snapshot is
missing. That guard exists because a reload's directory read can resolve after
the optimistic `addEntry` and silently drop a brand-new note forever.

Renaming moved the row but left the protection pointing at the **old** path.
So the reload that runs right after a rename found the untitled note missing
from disk, concluded it was a just-created note the snapshot had raced, and
restored it from memory. One file, two rows — and a restart cleared it because
the protection set starts empty. `replaceEntry` now moves the protection to the
new path.

### The wrong first fix, and why it looked right

The first attempt blamed a genuine inconsistency: the list mutations compared
paths with raw `===` while the rename flow finds its entry through
`notePathsMatch`, which normalizes separators and macOS's `/private/tmp` alias.
A differing spelling would make `replaceEntryByPath` no-op, leaving the old row
while the reload added the new one. That story fits the symptom exactly,
including the restart behaviour. Its regressions passed. It was still wrong.

The normalization change was kept — it is real hardening, and it also drops a
duplicate already sitting at the new path, which a file watcher can produce —
but it was not this defect.

What exposed it was rebuilding and repeating the actual user sequence
natively. The first regression tested `replaceEntryByPath` in isolation, where
the wrong theory is true by construction; the current one drives create →
rename → reload, which is where the real mechanism lives. **A green test
written from the same reasoning as the fix cannot falsify that reasoning.**

## C64 — "Prime is not installed" while the header says live

The window is up before Prime's service is listening, so the first status poll
can legitimately answer `not_installed` for an engine that is merely still
starting. `PrimeSessionSubhead` renders that verbatim — "Prime is not
installed — run npm i -g prime-agent" — telling the user to install software
they already have, seconds before the strip corrects itself.

`usePrimeHostStatus` now holds a problem back until a second poll agrees with
it. A genuinely missing install still surfaces, one poll (~4s) later. The same
guard covers `service_unreachable` and `service_too_old`, which race at launch
for the same reason; this is a startup-race guard, not a per-code special case.

## C63 — one-result graph search over-zoomed the node

`zoomToFit` frames the graph's bounding box, and a single node is a zero-size
box — so the camera flew in until one note filled the canvas as a ~500px dot.

`clampedCameraPosition` (`src/components/graph/cameraFraming.ts`) pulls the
camera back to `MIN_CAMERA_DISTANCE` while keeping its heading, and all three
`zoomToFit` call sites route through one helper. It lives in its own pure
module because `ForceGraph3DCanvas.tsx`'s header rule says to keep the only
WebGL file imperative and put testable logic outside it.

Two edges are handled deliberately: a lone node sits at the origin so the
framed camera can land there too, and scaling a zero-length vector yields NaN
and loses the scene — that falls back to a straight pull back. The delayed
clamp also checks `graphRef.current` before touching the graph, because the
view can unmount mid-transition and `_destructor()` will already have torn the
renderer down.

**`MIN_CAMERA_DISTANCE = 180` was tuned by reading, not by looking at it.**
Expect to adjust it the first time someone sees a one-node graph natively.

## C60 — blank window: mechanism found, cause still unproven

The saved window frame is restored **twice** at launch — `restore_main_window_state`
from `lib.rs:435` during setup, then again on `RunEvent::Ready`
(`window_state.rs:56-59`) — and `apply_window_frame` called `set_size` /
`set_position` unconditionally both times. Resizing an NSWindow while WKWebView
is still doing its first layout is a documented way to desync its compositing
layer.

That mechanism fits every part of the report, which is why it is the leading
candidate:

- it sits **below** the DOM, so re-rendering into the same stale backing store
  cannot fix it;
- it spares independently-composited layers, which is why the WebGL graph
  canvas painted while ordinary UI did not;
- it needs the process to restart rather than the page to reload;
- a rebuild is more likely to produce a saved frame that differs from current
  geometry, forcing a real resize instead of a no-op — which fits the
  intermittency being tied specifically to rebuild-and-relaunch.

`frame_needs_applying` now skips a restore that would not move the window.

**Do not close C60 on this.** The cause is inferred from code plus a known
WebKit failure class, not observed, and the bug was always intermittent — a
run of clean launches is weak evidence. Two further notes for whoever picks it
up: **"reload didn't fix it" may never have tested a real page reload** (no
`Cmd+R` binding exists in `useAppKeyboard.ts`, `lib.rs` or `menu.rs`; the only
in-app reload is `reload-vault`, which refetches files rather than reloading
the document), and persisted zoom was investigated and ruled out
(`useZoom.ts:11-26` clamps to 80–150 and falls back to 100).

## Verification

- `pnpm test` — **6003 passed** across 572 files.
- `cargo test --lib` — **1706 passed**, 20 ignored.
- `pnpm lint`, `pnpm typecheck`, `cargo clippy -- -D warnings`, `cargo fmt --check` all clean.
- Codacy: `trivy` reports 24 dependency advisories (4 high in each npm/pnpm
  lockfile, 0 critical), all pre-existing in lockfiles this session did not
  touch. `opengrep` on the changed files: 82 rules, **0 findings**. Note
  `opengrep` crashes with a `UnicodeDecodeError` unless run with
  `PYTHONUTF8=1 LC_ALL=en_US.UTF-8` — a tool-environment bug, not a finding.
- Localization: none — English only (C18).
- PostHog: no event needed — these are defect fixes to existing surfaces, not
  new user actions to measure adoption of.

### Native pass on the release build

Built, installed to `/Applications`, and driven through the real app:

- **C61 verified** — typed a draft, opened Graph, draft still there.
- **C63 verified** — filtered to one node; ordinary circle, not a wall of colour.
- **C62 reproduced, then fixed and re-verified** — see above. The pre-fix build
  showed two rows; the rebuilt one shows one.
- **C64 weakly verified** — three launches showed no false install instruction,
  but the symptom is a sub-second flash and the first look was ~6s in.
- **C60 not verified and not verifiable this way** — the window painted every
  launch, which is what an intermittent bug looks like most of the time.

Test notes were cleaned from `demo-vault-v2`; `git status` on the demo vaults is
empty. One unintended side effect: a stray Return sent the C61 test string to
the agent as a real prompt. It was stopped after one tool call.
