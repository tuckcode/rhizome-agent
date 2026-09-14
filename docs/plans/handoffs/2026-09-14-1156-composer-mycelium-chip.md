---
session: 2026-09-14T11:56-05:00
model: Composer 2.5 (Cursor)
description: >-
  Mycelium CirclesThree footprint chip accessibility check — SHIPPED.
---

# Mycelium footprint chip — SHIPPED

**Origin:** Composer 2.5 · 2026-09-14 · morning wave audit

## Verdict

**SHIPPED** — no code change needed.

## Location

`PrimeSessionSubhead.tsx` — the CirclesThree footprint button (`data-testid="prime-session-footprint"`) in the Chat session subhead. Opens this session's footprint in Connections → Mycelium (#22). Not inside `ConnectionsPanel` itself; that panel hosts the Mycelium tab content once opened.

## Evidence

| Check | Result |
|---|---|
| Accessible name | `aria-label={t('mycelium.title')}` → **"Mycelium"** |
| Tooltip | `title={t('mycelium.title')}` → **"Mycelium"** (native) |
| Unit test | `PrimeSessionSubhead.test.tsx` — `getByLabelText('Mycelium')` on footprint click |

## Notes

- Uses shadcn `Button` with icon-only variant; label comes from `en.json` key `mycelium.title`.
- Context menu "View in Mycelium" in `PrimeSessionListContextMenu.tsx` is a separate, already-labeled path.
- `MyceliumView.tsx` header CirclesThree icon is decorative (`aria-hidden` not needed — adjacent visible "Mycelium" text provides the name).
