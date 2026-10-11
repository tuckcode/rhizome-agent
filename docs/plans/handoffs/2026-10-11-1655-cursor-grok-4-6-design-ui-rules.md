---
session: 2026-10-11T16:55Z
model: Cursor Grok 4.6
description: >-
  Docs-only: living UI rules, component notes checked against source,
  AGENTS.md pointer, and Earth DESIGN.md matched to the shipped app.
  No app code. Critiquito optional cleanups left out.
commits: cursor/design-docs-ui-rules-6a7e
---

**Origin:** Cursor Grok 4.6 · 2026-10-11 · Critiquito merge plan, knispo-approved.

Did not edit `docs/HANDOFF.md`. Re-verified against `origin/main` at
`7997dee` (same SHA the plan used). No app code. The plan's optional
accent-blue and raw-button cleanups stay out of scope.

## What landed

- `docs/design/ui-rules.md` — role tokens, `primary` not `accent-blue`,
  Earth 4.5:1 text tiers, keep the 3px focus ring, state-true copy
  ("engine" not "Prime"), sizing at the 14px root.
- `docs/design/components.md` — one page on the 17 shadcn controls plus
  `BrandMark`, written from `src/components/ui/*.tsx` after the Oct 4
  export notes were checked. No BrandLockup section.
- `AGENTS.md` "UI components — mandatory rules" now points at those
  docs and `docs/design/earth-theme/DESIGN.md`. Toggle row is `Switch`
  only (`ToggleGroup` is not in `src/components/ui/`).
- `docs/design/earth-theme/DESIGN.md` now matches the shipped app:
  IBM Plex Mono is `font-mono`; JetBrains Mono 600 is wordmark-only;
  radii 3/5/7/11px as used; 3px `ring/50` halo; six-node mark until the
  dithered root mark lands.

## Plan claims that were wrong against the code

- **Cards 7px / dialogs 11px.** Inverted. `card.tsx` is `rounded-xl`
  (11px). `dialog.tsx` is `rounded-lg` (7px). Docs describe the classes.
- **Oct 4 component READMEs.** The zip is not in this tree. Notes were
  written from the current source, then the two named drifts were
  applied: no destructive 60% fill (`button.tsx` / the destructive
  contrast test), and Select items use `bg-accent` while
  `DropdownMenuItem` uses `border-strong`.
- **Placeholders already use `text-faint`.** Input and Textarea use
  `placeholder:text-muted-foreground`, which aliases `text-secondary`.
  `ui-rules.md` keeps `text-faint` as the convention for new hint copy
  and names the alias so agents do not treat the shadcn class as faint.
- **Dialog close uses the 3px halo.** The close X uses a 2px ring plus
  2px offset. `components.md` says so.

## Not in this PR

Accent-blue call sites that ignore the picker, `--state-focus-ring`
staying green under every accent, and the raw-element count outside
`src/components/ui/`. Those stay in the plan's optional section.
