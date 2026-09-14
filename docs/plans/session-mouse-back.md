---
status: paper
origin: Cursor Grok 4.6 · 2026-09-14 · five-hour burn
---

# Session mouse-back — not coded this window

**Origin:** Learned pref: mouse back/forward should walk in-note / wikilink
history **and** session navigation.

## What already shipped

`useNavigationGestures` + `useAppNavigation` walk the **note** trail
(note → wikilink → note). Tests cover buttons 3/4 and WKWebView swallow.

There is **no** session history stack.

## Why this file exists

The note trail is done. Wiring the same buttons to Prime sessions needs
one product call: when both a note trail and a session trail exist, which
wins?

Guessing a dual stack in a 5-hour burn would fight the note trail.

## Smallest later slice (after the call)

1. Record last N session ids the user clicked (not transcript content).
2. Mouse back: if the note trail can move, it still wins (today’s
   behavior). If it cannot, switch session.
3. Do not invent a create-from-back path. Do not call `rename`.

**Stop:** no new keyboard chord. No browser `history.pushState`.

**Stamped 16:08:** still no winner. Source lock only — mouse-back still
walks the note trail. Do not add a session stack this window.

## Docked

Listed in
[`handoffs/2026-09-14-1145-cursor-grok-4-6-docked-questions.md`](handoffs/2026-09-14-1145-cursor-grok-4-6-docked-questions.md)
as later, not this window.
