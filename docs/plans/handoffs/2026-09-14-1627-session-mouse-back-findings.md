---
session: 2026-09-14T16:27-05:00
model: Grok 4.6 (Cursor)
description: >-
  Session mouse-back findings: note trail shipped, session stack
  absent, winner unpicked. Do not encode a winner this window.
commits: none
---

# Session mouse-back — findings

**Origin:** Cursor Grok 4.6 · 2026-09-14 16:27 · findings only.  
**Sources:** [`docs/plans/session-mouse-back.md`](../session-mouse-back.md) · `src/hooks/useNavigationGestures.ts`.

Did not edit product code. Did not add a session stack. Did not pick a winner.

## Status

| Field | Value |
|---|---|
| **Note trail** | **Shipped** — mouse buttons 3/4 walk note → wikilink → note |
| **Session trail** | **Not built** — no session history stack |
| **Winner** | **Unpicked** — stamped 16:26 still no winner |
| **This window** | Source lock only. Do not add a session stack. Do not encode a winner. |

## What already shipped

`useNavigationGestures` listens capture-phase on `mousedown` / `mouseup` / `auxclick`. Button 3 is back; button 4 is forward. It calls `onGoBack` / `onGoForward` once per press (`consumedButton` de-dupes down+up) and `preventDefault` + `stopPropagation` so a focused editor or WKWebView cannot treat the click as browser history.

The hook itself is trail-agnostic. The plan of record says those callbacks walk the **note** trail via `useAppNavigation`. Tests cover buttons 3/4 and the WKWebView swallow.

There is **no** session id stack, no last-N session clicks, and no session switch on mouse-back.

## Open product call (do not encode)

When both a note trail and a session trail exist, **which wins?**

The paper exists because guessing a dual stack in a short burn would fight the shipped note trail. Prefer remains unpicked. Do not write a winner into code, tests, or living docs from this file.

## Smallest later slice (after the call)

From [`session-mouse-back.md`](../session-mouse-back.md) — proposal only, not a decision:

1. Record last N session ids the user clicked (not transcript content).
2. Mouse back: if the note trail can move, it still wins (today’s behavior). If it cannot, switch session — **only if Atticus picks that**.
3. Do not invent a create-from-back path. Do not call `rename`.

**Stop:** no new keyboard chord. No browser `history.pushState`.

## Not this window

- Do not add a session history stack.
- Do not encode a winner between note trail and session trail.
- Do not change `useNavigationGestures` to fan out to sessions.

Docked as later in [`2026-09-14-1145-cursor-grok-4-6-docked-questions.md`](2026-09-14-1145-cursor-grok-4-6-docked-questions.md).
