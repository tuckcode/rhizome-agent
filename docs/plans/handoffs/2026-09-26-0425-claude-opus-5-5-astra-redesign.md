---
session: 2026-09-26T04:25-05:00
model: Claude Opus 5.5
description: >-
  Implemented Astra's native-audit redesign (all visual-review proposals),
  the login-error note skip, and ordered-list markers. Pushed d0a55f8 and
  rebuilt /Applications from it at 04:21 CDT. Native QA not done.
commits: 70fffb8..d0a55f8
---

# Astra redesign — pushed and installed

**Origin:** Claude Opus 5.5 (Claude Code desktop) · 2026-09-26 04:25 CDT.

| Field | Value |
|---|---|
| origin/main | `d0a55f8` |
| local HEAD | `d0a55f8` |
| App | `/Applications/Rhizome Agent.app`, installed 2026-09-26 04:21 CDT, adhoc, `ai.rhizome.agent` |
| Build copy | removed from `src-tauri/target/.../bundle/macos` after install |

Source: [`2026-09-25-astra-native-frontend-audit-report.md`](../2026-09-25-astra-native-frontend-audit-report.md)
(untracked in this tree with its `evidence/` screenshots — the screenshots
show real Inbox entries, so they were not committed ahead of going public).

## What shipped

- **Auth-error notes** — both junk guards now reject `Not logged in` /
  `Please run /login` (`70fffb8`). The full auto-save path was not traced.
- **List markers** — Tailwind preflight had removed them (`687741c`).
- **Grok's rail fix** — committed with a lint fix (`78cb57e`).
- **Reading column** — prompt, reply, composer share 46rem; tables and code
  may grow to the transcript width.
- **Compact composer** — input, then one row: Model · Think · Tools (Goal,
  Schedule, skill) · context % (meter in a popover). Status only while
  working. Key hints on the Send tooltip.
- **Chat header** — conversation title first; session id / vault / uptime
  behind a status dot. Title re-reads when a turn ends and never shows a
  previous session's title.
- **Note / Notes headers** — tools fold into "…" before the title; Close
  stays visible. Two real bugs found in browser review after the agent's
  tests passed: the list title's wrapper squeezed to 0px, and the
  breadcrumb check anchored on an off-screen edge.
- **Settings** — the picked section lands at the top, even after Packages
  lazy-loads; plain-language auto-save with "Technical details".
- **Workspace states** (`70e5f48`) — conversation → research desk (note
  beside Chat when both fit without folding a shown column) → focused window
  (Chat / Notes tabs when they cannot both fit). On top is an explicit,
  stored choice. Narrow windows get a Sessions drawer with a scrim that
  closes on scrim, Escape, or a session pick.

PostHog: `composer_pill_opened` (`tools`, `context_usage`),
`sessions_drawer_opened`, `focused_pane_switched`.

## Verified vs not

- Verified: vitest 6847 passing; lint; typecheck; full push gate (Rust,
  coverage, smoke); browser preview (mock-tauri) at 700/1000/1400/1500px.
- **Not verified:** anything in the packaged app. The Chat title in the mock
  host always reads "New chat" (no session path), so live title updates are
  unit-tested only.
- Smoke: 7 specs pass only on retry. Not checked whether that predates
  this session.

## Open

- VaultPanel "Notes" heading and a list titled "Notes" can stack twice.
  Left alone: product call, not a layout bug.
- Import and repo research write notes without the junk-title guard.
- Grok's `.cursor/rules/one-job-in-flight.mdc`,
  `docs/model-misfires/2026-09-21-cursor-grok-4-7.md`, and `.tmp-look/`
  remain uncommitted, untouched by this session.
