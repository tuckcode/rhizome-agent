---
session: 2026-09-14T12:40-05:00
model: Grok 4.6 (Cursor)
description: >-
  Astra D2 Chat visual. Vite mock PASS at 800 and 1280.
  Idle foot 12px and readable. Long context pill truncates at 800
  and never covers Send or model chips. Working and preflight
  NOT RUN in mock. No product edit. No commit.
commits: none
---

# Astra D2 — Chat visual — 2026-09-14 12:40

**Origin:** Cursor Grok 4.6 · Astra D2 leftover · no commit

**Result: PASS** (browser / Vite mock only). Native `/Applications`:
**NOT RUN** (not requested; no `pnpm tauri`).

Did not rebuild. Did not commit. Did not change
`ChatComposerDeck.tsx`, `ChatComposerFoot.tsx`, or
`ChatPreflightBanner.tsx`.

## How it was reached

D1's `http://127.0.0.1:5202/` process had already died
(`[ELIFECYCLE] Command failed`). Restarted the same `pnpm dev`
on **5202** (`vite.config.ts` `strictPort: true`). That is this
repo's mock-tauri Vite, not a second concurrent server and not
a native launch.

Cursor's built-in browser tab still would not stay open. Chat
was opened in Playwright Chromium against that Vite, same as D1.

Path: launch Chat (`chat-center`) → measure the composer foot →
Notes already open → right-click a long note →
**Ask the agent about this note**.

Mock vault titles are short. To see overflow I seeded one long
title through `list_vault` (`a-very-long-imported-session-title-that-would-overflow-the-composer.md`),
then used the real Ask-agent path. Full name stays on `aria-label`
and `title`.

## What I saw

| Check | 1280 × 900 | 800 × 900 |
|---|---|---|
| Idle foot | `12px`, `Idle · ready`, contrast **7.79:1** | same size and copy |
| Working foot | **NOT RUN** — mock send finishes idle | same |
| Long context pill | full name fits; wraps; no cover | ellipsis; own row; no cover |
| Send / model chips | both visible, no overlap | both visible, no overlap |
| Preflight banner | **NOT RUN** — mock has no `preflight_chat` | same |

Send is the paper-plane control under the chips. Model is the
`Mock model` chip. At 800 the pill sits on the next row and
clips with `truncate` (`spanScrollWidth` 502 vs `spanClientWidth`
465). It does not cover Send or the model chip.

Working copy uses the same `text-[12px]` node. Mock-tauri never
stays in a turn, so `Working` / `Working · last tool …` was not
painted. No clip to fix.

## Not this session

- Native packaged Chat
- `/Applications` rebuild
- Commit / push
- `HANDOFF.md` edit (parallel writers)
