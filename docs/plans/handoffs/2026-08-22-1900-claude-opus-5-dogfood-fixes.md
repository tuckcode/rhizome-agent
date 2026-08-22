---
session: 2026-08-22T19:00Z
model: Claude Opus 5
description: >-
  A live dogfooding pass found five defects a green suite could not see —
  autoscroll, a link that stranded the app, a full-panel opacity pulse, no
  drag region on Chat, and traffic lights sitting low. #41 wired: steer and
  follow-up queueing existed end to end in Rust and were reachable from
  nothing. The pre-push hook now repairs its own environment.
commits: 19a83a9..cca7302
---

# 2026-08-22 (evening) — what using the app found

**State:** `main` at `cca7302`, pushed, tree clean.

Continues `2026-08-22-1600-claude-opus-5-graph-queries.md`. Everything here
came from Atticus running the app and saying what he saw. **Every single one
was invisible to the test suite**, and that is the finding, not the
individual bugs.

### Five defects, none catchable by the gates as written

- **`19a83a9` — autoscroll fought the reader.** `AiPanelMessageHistory`
  called `scrollIntoView` on every change to `messages`, unconditionally.
  One `AiAgentMessage` is a whole exchange, so a streaming response mutates
  the last message repeatedly — the effect fired per chunk. Following is now
  a mode: true while parked within 48px of the bottom, false the moment you
  scroll up. Sending re-pins (list length grows per exchange, not per chunk);
  scrolling back down resumes. **jsdom reports every box as 0×0**, so the
  existing tests saw a viewport permanently at the bottom — the new ones
  define real geometry.

- **`b165e18` — a chat link stranded the app.** `MarkdownContent` handled
  `http(s)` and fell through to a bare `<a href>` for everything else. The
  app has no browser chrome, so navigating away is one-way. Three buckets
  now: web links open externally (including scheme-less `www.`), OS-handled
  schemes (`mailto:`/`tel:`/`sms:`) stay anchors, **everything else is
  inert**. Scheme-less detection is `www.`-only on purpose — `notes/foo.md`
  also parses as a bare domain, `.md` being a real TLD.

  **The existing test passed because it added its own `preventDefault`
  listener before clicking.** The anchor looked inert because the test made
  it so. Worth remembering as a shape: a test that installs the guarantee it
  is asserting.

- **`6b5aada` — the whole panel faded, twice a second.** `ai-border-pulse`
  animated `opacity: 1 → 0.6` and is applied to the `<aside>` wrapping the
  entire panel; opacity applies to the whole subtree. Now fades
  `border-left-color` via `color-mix`. Guarded by a test that parses the
  keyframe body for inheritable properties — verified by stashing the fix and
  confirming it goes red.

- **`4f46a3b` — Chat could not be dragged.** Notes has drag regions on the
  breadcrumb bar and editor; Chat's topmost band is `PrimeSessionSubhead`,
  which had neither. On the landing surface there was nowhere to grab the
  window.

- **`98181a2` — traffic lights sat low.** `trafficLightPosition.y` was `24`
  — the *top* of ~12px controls — in a `min-h-[30px]` strip, so a third of
  each hung below its band. Now `9`. The value came in with the Desktop
  bootstrap and was tuned for a taller header. **Unverified by eye at time of
  writing.**

### #41 — the wiring that was never done

Prime's daemon has always accepted `steer` and `follow_up`.
`prime_session_host::{steer, follow_up}` wrap them with tests,
`steer_prime_session` / `follow_up_prime_session` expose them, both are in
`generate_handler!`, and `AiPanelComposer` already rendered a Steer button
with seven passing tests. **Nothing ever passed `onSteer`**, so `canSteer`
was always false and the composer locked to a Stop button.

That is the `AiAgentsBadge` pattern for the second time in this repo: a
complete feature, tests green, unreachable — because the tests exercise the
component directly and nothing asserts the prop is supplied. The new tests
assert from `AiPanelView` for exactly that reason.

Enter queues a follow-up; Steer is separate and explicit. Asked which people
use, Atticus said **"i do both"** — so both are first-class, and
`prime_turn_message` records only which kind. `sendToRunningTurn` lives in
`lib/primeTurnMessaging.ts` so the `false`-means-not-streaming contract is
written down once: it means the turn ended between keystroke and call, and
the message must be sent as a new turn rather than dropped.

`f0b37e1` wiring, `d56c752` the visible queue. **Not natively verified** —
Atticus will confirm. Do not close #41 before he does.

### The hook repairs its own environment now — `cca7302`

Two pushes failed today for reasons unrelated to any change:

- **`LLVM_COV` / `LLVM_PROFDATA`** had to be exported by hand. Agents cannot
  win: shell state does not persist between tool calls, so it must be in the
  same command as every push, and a retry that captures error output drops
  it. `ensure_llvm_coverage_tooling` now fills them from `brew --prefix llvm`
  when unset. The hook already had this shape in `ensure_cargo_tooling`.
- **Playwright's browser binary vanished** between two pushes an hour apart —
  it pins a build per version, and a bump orphans the cache. The failure is
  disguised: all 26 specs die inside `browserType.launch` in ~1ms, reading as
  "your change broke everything". Running one spec directly showed the real
  message. `ensure_playwright_browser` installs it.

**Caveat: the LLVM path is not verified end to end.** That commit was
docs/hooks only, so the gates skipped and the Rust lane never ran. The
function was verified in isolation with both vars unset. The next code push
is the real test — if the Rust lane fails there, the fix is wrong.

### Open

- **#41** awaiting native confirmation. **#42** tool cards say `ipython` five
  times — `prime_tool_unwrap` should learn the `%%bash` shape that
  `mycelium::extract_bash_from_ipython` already knows. **#43** window-level
  navigation guard — **an agent in Orca has this**, in a worktree at
  `rhizome-agent/<branch>/`. Stay off it.
- That worktree is a full second checkout nested inside this repo. It broke a
  push by making `eslint .` walk its generated files (`97ddb6e` ignores it),
  and it is the third such directory to need gitignoring today. It is also
  the most likely source of the Playwright version bump.
- C40 (`rhizome_graph_summary` still on the external CLI), C42 (Windows never
  launched), C39, C37, C33.
