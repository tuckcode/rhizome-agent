# Let the agent see the running app — plan for #50

**Origin:** Grok 4.6 (Cursor) · 2026-08-29 · GitHub #50

**Status:** awaiting Atticus approval. Nothing in this file has been built.

Agents cannot reliably look at Rhizome while it runs. macOS screen-recording
and Accessibility grants drop every time the app is rebuilt (the signature
changes). That is why the chat transcript had no scroll box for three days
while thousands of tests stayed green: nothing in the loop was reading the
*drawn* page.

This plan answers the three questions in #50 and names a first slice small
enough to ship in one session.

---

## Recommended MVP (one paragraph)

Ship a developer command, `pnpm live-ui`, that talks to the already-running
browser app (`pnpm dev`) the same way Playwright already does. It does not
photograph the native window, so macOS permissions never enter. For each
screen it prints three things an agent can read: the four existing layout
checks (`uiAudit`), whether named panels can actually scroll, and a compact
list of on-screen controls with sizes. Switching screens uses the test
bridge already on `window.__rhizomeTest`, not pixel clicks. This is tooling
next to `pnpm deadcode`, not a new place in the product. Mycelium’s iframe
is the proof that loading a live URL works; the first slice uses Playwright
as that frame rather than embedding a second copy of Rhizome inside itself.

---

## The three questions

### 1. Which app does it show?

| Option | What you get | What you lose |
|---|---|---|
| **A. Browser app (`pnpm dev`)** | Cheap. No macOS permission. Same page Playwright already audits. Layout bugs (missing scroll, overlapping buttons, tiny targets) show up here. | Cannot exercise Rust: native menus, tray, window chrome, folder-permission prompts. |
| **B. Native app (`pnpm tauri dev` / a built `.app`)** | The real product. | Exactly the permission problem this issue exists to dodge. The unsigned debug binary cannot keep a Screen Recording grant. A signed `.app` can, until the next rebuild. |
| **C. Both, later** | Full coverage. | Two pipelines. Do not start here. |

**Recommend A for the first slice.** The defects that survived 5,829 tests
were CSS/layout. They are visible in the browser build. Native-only checks
stay on computer-use / a bundled `.app`, as they do today.

### 2. Read-only, or also click and type?

| Option | What you get | Cost |
|---|---|---|
| **A. Read-only dump** | Element tree, sizes, console, layout-check findings. Enough to catch the missing-scroll class of bug. | Cannot prove “clicking Send actually sends.” |
| **B. Full drive (click / type like a person)** | End-to-end flows. | A second Playwright, plus all the flake that comes with driving UI. The issue itself calls this much more work. |
| **C. Read + *steer* through the existing test bridge** | Change screen, open a note, fire a menu command — then read again. No pixel aiming. | Small. `window.__rhizomeTest` already does this for smoke tests. |

**Recommend A + C.** Read first. Navigate with the bridge (`dispatchAppCommand`,
rail `data-testid`s). Do not add free-form click/type in slice 1.

`uiAudit` is already read-only on purpose: it reports, it never clicks.

### 3. In the app, or beside `pnpm deadcode`?

| Option | What you get | Risk |
|---|---|---|
| **A. A new pane in Rhizome** (Mycelium-style iframe of the app) | A person can look at it too. | Recursion (the app containing itself), more product chrome, and Mycelium is already a modal-over-the-app problem. This is agent infrastructure, not a user feature — #50 says so. |
| **B. Developer command** (`pnpm live-ui`, like `pnpm deadcode`) | Agents run it on demand. Output is text. No permission, no extra window. | A person who wants a picture still uses the browser or a screenshot. |
| **C. MCP tool wrapping B** | Cursor / Claude Code / later Prime call one tool instead of remembering a script. | Extra wiring. Do it after B works. |

**Recommend B, with C as the next slice.** Keep A off the table until
someone actually wants to *see* a live copy inside the product. If that
day comes, copy Mycelium’s pattern: start a URL, put it in an iframe,
list of screens on the left — but as a **dev-only** page, not a rail
destination.

---

## What already exists (reuse, do not rebuild)

| Piece | Path | Job in the MVP |
|---|---|---|
| Layout rules | `src/utils/uiAudit.ts` | Same four checks the regression lane already runs. Import them in the page, as `tests/smoke/ui-audit.spec.ts` already does. |
| Screen walk | `tests/smoke/ui-audit.spec.ts` | Six rail destinations at 1440×900. Copy the screen list and the “wait for settle” habit. |
| Baseline | `tests/ui-audit-baseline.json` | Known duplicates. The dump should *show* them, not fail the command — `pnpm live-ui` is a flashlight, not a gate. The existing spec stays the gate. |
| Test bridge | `src/types/rhizomeTestBridge.ts`, filled in `src/main.tsx` | `dispatchAppCommand`, deep links, shortcuts. Add `auditUi` (and a small snapshot helper) onto this object so a connected page does not need Vite’s `/src/utils/uiAudit.ts` import. |
| Embed proof | `src/components/MyceliumView.tsx` | Sidecar URL → `<iframe>`. The MVP’s “iframe” is Playwright loading `pnpm dev` (Vite’s port is **5202**; Playwright’s default target is **5201**). |
| Inspect skill | `~/.claude/skills/inspect/collect.sh` | Daemon and session logs only. Does not see the drawn UI. `pnpm live-ui` is the missing half. |

**Gap `uiAudit` does not cover.** The three-day missing scroll box was not
dead/duplicate/tiny/overlapping. It was a panel whose height grew with its
content, so `overflow-y-auto` never had anything to overflow (see the comment
in `src/components/AiPanel.tsx`). The dump must include **scroll metrics**
for named wells (`scrollHeight` vs `clientHeight`, computed `overflow-y`).

---

## First slice — what to build

One command. One output. No product UI.

```text
pnpm live-ui              # all six screens
pnpm live-ui --screen chat
```

Talks to whatever is already on `BASE_URL` (default `http://localhost:5201`,
same as Playwright). If nothing is listening, start Vite the way
`playwright.config.ts` already does (`reuseExistingServer: true`).

For each screen:

1. Switch using the rail `data-testid` or `__rhizomeTest.dispatchAppCommand`.
2. Wait briefly for layout to settle (the audit spec uses 600ms).
3. Collect:
   - `auditUi()` findings
   - scroll metrics for a short allow-list of wells (`chat-center`, transcript
     scroller, notes list, sessions column)
   - compact control tree: `data-testid` or accessible name, role, x/y/width/height
   - console errors since load
4. Print markdown to stdout (agents paste this into context). Optionally write
   the same blob to a gitignored file (`/tmp/rhizome-live-ui.md`) so a second
   tool can read it without rerunning.

**Not in slice 1:** screenshots, native window attach, an in-app pane, MCP,
click/type, a new push-gate.

### File touch list

| File | Change |
|---|---|
| `scripts/live-ui.mjs` | **New.** Playwright script: connect, walk screens, print markdown. |
| `package.json` | `"live-ui": "node scripts/live-ui.mjs"` |
| `src/utils/uiAudit.ts` | Add `snapshotUi(root)` (or sibling module) returning scroll wells + compact control boxes. Keep `auditUi` unchanged. |
| `src/utils/uiAudit.test.ts` | Tests for the new snapshot helper (jsdom: a box that cannot scroll vs one that can). |
| `src/types/rhizomeTestBridge.ts` | Optional `auditUi` / `snapshotUi` on the bridge. Ambient file — already in `knip.json` ignore. |
| `src/main.tsx` | Attach those two functions on `window.__rhizomeTest` at boot. |
| `tests/smoke/live-ui.spec.ts` | **New, untagged** (regression lane, not the 5-minute smoke). Asserts the dump contains `auditUi` keys, at least one named well, and does not throw when Chat is open. |
| `.gitignore` | `/tmp`-style local dump if we write inside the repo at all. Prefer `/tmp`. |

Do **not** touch `MyceliumView.tsx` in slice 1. It is the pattern to copy
later, not a file to edit now.

### Later slices (only after this works)

2. **MCP tool** `rhizome_live_ui` wrapping the script (stdio MCP, Cursor and
   Claude Code). Same output. Optional `--screen`.
3. **Steer verbs** on the same tool: `go chat` / `go inbox` via the bridge,
   then dump again.
4. **Dev-only HTML report** — Mycelium layout: findings left, iframe of
   `pnpm dev` right. Not on the command rail.
5. **Native attach** — only if we need Rust-backed screens. Bundled `.app` +
   computer-use, or webview CDP. Separate issue.

---

## Test strategy

TDD on the new helper, not on Playwright first.

1. **Red.** jsdom test: a `flex-1` column with `overflow-y-auto` but a block
   parent reports `canScroll: false` and `scrollHeight === clientHeight`.
   A `min-h-0 flex` parent reports the inner well as a scroller. This is the
   regression the missing transcript box would have failed.
2. **Green.** Implement `snapshotUi`.
3. **Command smoke.** `tests/smoke/live-ui.spec.ts` against Vite: Chat screen
   dump includes `chat-center`, runs `auditUi`, and lists findings (including
   known baseline duplicates — the command must not fail on them).
4. **Do not** add this command to the pre-push gate. `ui-audit.spec.ts`
   remains the ratchet. A flashlight that is red on day one gets ignored —
   the same failure the audit baseline was written to avoid.
5. **Manual check (the session that builds it).** With `pnpm dev` up, run
   `pnpm live-ui --screen chat` and confirm an agent can answer “does the
   transcript scroll?” from stdout alone, without a screenshot.

Coverage: the new helper is unit-tested; the smoke spec is behavioral. No
Rust. Localization: no UI copy. PostHog: none — this is not a user action.

---

## What would have caught the scroll-box bug

A dump that includes, for `chat-center` / the transcript well:

```text
well  transcript  800x640  overflow-y: visible  scrollHeight=640  clientHeight=640  canScroll=false
```

instead of only `auditUi` returning `[]`. Slice 1 is specifically that
number, plus the four rules we already have.

---

## Approval

Please confirm or change:

1. Browser app (`pnpm dev`), not native, for slice 1.
2. Read + steer through the test bridge; no click/type yet.
3. `pnpm live-ui` as developer tooling; no in-app pane.

If yes, the next session builds the file-touch list above and stops there.
