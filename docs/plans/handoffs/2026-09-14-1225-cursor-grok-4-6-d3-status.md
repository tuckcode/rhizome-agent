---
session: 2026-09-14T12:25-05:00
model: Grok 4.6 (Cursor)
description: >-
  D3 status and recovery presentation. Two contrast/size defects
  on existing W4 chrome. Did not invent Queued/Stopped/Connection
  unknown. Mid-turn failed banner still missing (finding). Native
  NOT RUN. No commit.
commits: none
---

# D3 — status and recovery legible

**Origin:** Cursor Grok 4.6 · Astra D3 only · no commit

Cap is three observed presentation defects. Reused the current W4
state contract. Did not change Enter/Esc, hide-on-close, or Prime
queue verbs. Did not edit BOARD / HANDOFF / living index.

W4 pointer:
[2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md](2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md).
Native cases stay **NOT RUN**. Installed app stays `476756c`.

## Existing contract (not invented)

| Evidence in code | User-visible copy | Not added |
|---|---|---|
| Prime accepted a queued follow-up | `Waiting in this session` + Steer / After + message | `Queued` |
| Prime reports active execution | Composer foot `Working` / `Working · last tool {tool}` | a second Working badge |
| Stop confirmed | none as a dedicated label; foot returns to `Idle · ready` | `Stopped` |
| Provider/vault blocker | Preflight title + reason + remedy | a success badge |
| Host problem codes | Subhead install / unreachable / too-old copy | `Connection unknown` |
| Mid-turn transport `failed` | draft kept, **no Chat error banner** | a fabricated failure toast |

A missing event is a finding. Do not treat silent draft-keep as a
useful error. Same observation as W4 2026-09-13. Did not patch it.

## Defects fixed (2 of 3)

1. **Queue chrome was quieter than the idle/working foot.**
   After D2 the foot is 12px. Queued follow-ups were still 11px
   muted — the surface W4 says must stay visible. In
   `AiPanelChrome.tsx`: label `Waiting in this session` is 12px
   medium foreground. Lane prefix (Steer / After) stays muted.
   Message text is 12px foreground. Spacing `mb-2` / `gap-1`.
   Clear / Steer / After / Waiting copy unchanged.

2. **Preflight recovery sat behind muted chrome.**
   D2 already kept title/body at 12px. Remedy still inherited
   muted, and the Warning icon was muted, so a failed vault
   looked like a hint. Icon is amber (`--accent-amber`) at 16px.
   Reason and remedy are both 12px foreground. Spacing `mb-2` /
   `mt-1`. Title copy unchanged. `role="status"` unchanged.
   Banner still hidden when the check is ok or the check itself
   throws.

No third defect. Session-switch `switchError` is already 12px
destructive. Subhead live / idle / problem is already split by
green, muted, and amber-foreground. Header status is unused on
ChatHome (`showHeader={false}`).

## Findings (not patched)

- Mid-turn `sendToRunningTurn` `'failed'` still sets no Chat
  error banner. W4 finding. Presentation cannot invent it.
- No `Connection unknown` state exists. First disagreeing poll
  still withholds the problem (C64). Idle is what the subhead
  shows until a code is corroborated.
- Native send / recover / steer / hide: **NOT RUN**.

## Tests

`npx vitest run` on five neighbor files: **67/67 pass**
(`ChatPreflightBanner` 5, `AiPanelComposer.queue` 4,
`AiPanelComposer.steer` 8, `ChatComposerFoot` 4, `AiPanel` 46).

jsdom. Not Prime. Not `/Applications`.

No commit. No push. No `#66` merge. No list-import. No
`/Applications` rebuild. No memory badges.
