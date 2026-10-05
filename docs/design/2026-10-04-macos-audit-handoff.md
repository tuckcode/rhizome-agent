---
session: 2026-10-04T17:05:00-05:00
model: Astra through Hermes desktop
description: >-
  Compact macOS native audit handoff for Cursor on the Mac.
  Tests commit c34b9a5. Native checks only; no source edits.
---

# macOS native audit — commit c34b9a5

**Origin:** Astra through Hermes desktop · 2026-10-04.

## Task

Run the focused native macOS audit on commit **`c34b9a5`**.
This is the final gate. Do not edit source. Do not commit or push.
Report evidence only.

## Read first (on the Mac)

1. `AGENTS.md` and `docs/CROSS-MODEL-HANDOFF.md`
2. `docs/design/2026-10-04-ui-audit.md` — the findings
3. `docs/design/2026-10-04-cursor-implementation-result.md` — what Cursor changed

## Checkout

```bash
git fetch origin
git checkout c34b9a5
```

Confirm the checkout before testing:

```bash
git log -1 --oneline   # expect c34b9a5
```

## Build

Use the debug bundle or a rebuilt `.app`. Do not test Rhizome Desktop.
Quit any running Rhizome Agent first (single-instance per bundle id).

```bash
pnpm tauri build --bundles app
```

## Checklist — record each with a screenshot or AX evidence

1. **Cold startup:** window appears without a blank or white flash.
2. **HTML splash:** first paint shows the mark and wordmark in the correct theme.
3. **React splash:** the transition does not replay the entrance animation.
4. **Theme:** light, dark, and system modes match the saved selection on launch.
5. **Wordmark font:** `rhizome` renders in JetBrains Mono, not a fallback.
6. **Retina text:** text is crisp at native display scale.
7. **Dock icon:** the Signal mark shows correctly.
8. **Traffic lights:** the three buttons sit clear of the sessions rail.
9. **Scrolling:** chat and Notes scroll smoothly; no trackpad jank.
10. **Settings:** opens with `Cmd+,`; theme names fully visible; Escape closes and returns focus.
11. **Destructive button:** text contrast is readable in light and dark.

## Evidence format

Write `docs/design/2026-10-04-macos-audit.md` with:

- The exact commit and build.
- One line per checklist item: PASS / FAIL / NOT TESTED.
- A screenshot path or AX note for each item.
- Any defect with a reproduction step.

## Report back

State what you actually ran and its output. Do not claim a pass you did not observe.
Mark anything untested as NOT TESTED.

## Exclusions

- No source edits, commits, pushes, or installs.
- No full audit repeat. This is the focused native pass.
- Do not test Rhizome Desktop.
