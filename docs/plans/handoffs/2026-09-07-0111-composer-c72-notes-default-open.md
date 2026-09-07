---
session: 2026-09-07-0111
model: Composer
description: >-
  C72 partial — fresh launch defaults to editor-list (right Notes open); Chat
  no longer forces editor-only; Mycelium footprint tooltip says Mycelium.
commits: pending
---

# C72 — Notes column open by default

**Origin:** Composer · 2026-09-07 · C72 Atticus priority slice

Priorities brief: [0110](2026-09-07-0110-composer-c72-atticus-priorities.md).  
Park / why it felt broken: [1814](2026-09-06-1814-composer-c72-side-panel-session.md).

## Product call (this slice)

**Default right Notes open on launch** (`editor-list` — Notes visible, Browse
collapsed). Do **not** rename Inbox. Optional: Mycelium CirclesThree tooltip.

## Code

1. `useViewMode` / `loadViewMode`: unset → `editor-list` (was `editor-only`).
2. `App` CommandRail `onSelectChat`: stop calling `handleSetViewMode('editor-only')`.
   Inbox still toggles open/closed. Explicit “Chat only” command still works.
3. `PrimeSessionSubhead` footprint chip: `aria-label` / `title` → `mycelium.title`
   (“Mycelium”).

## Tests

- `useViewMode.test.ts` — default + invalid-fallback expect `editor-list`.
- `PrimeSessionSubhead.test.tsx` — label “Mycelium”.

## Verify

```bash
npx vitest run src/hooks/useViewMode.test.ts src/components/PrimeSessionSubhead.test.tsx
# Dev: clear vault view_mode / rhizome-view-mode, launch — right Notes should show
# Packaged /Applications from 15:47 will NOT show this until rebuild
```

## Still open (C72 remainder)

- Right-hand icon rail (ADR-0170 undecided).
- Inbox rename (deferred; toggle still left-rail Inbox).
