---
session: 2026-10-16T06:28Z
model: Cursor Grok 4.6
description: >-
  Verified Settings model menu theme: classes and CSS vars live on html,
  not #root. Body portal stays styled. Hover screenshots in both themes.
commits: cursor/settings-model-dropdown-f40f
---

**Origin:** Cursor Grok 4.6 · 2026-10-16 · Theme-root check after PR #175 unstyled-menu note.

Did not edit `docs/HANDOFF.md`.

## Theme location (live app on :5201)

`applyThemeModeToDocument` / `applyAppearanceToDocument` write
`data-theme`, `.dark`, and `data-color-theme` on
`document.documentElement`. `#root` has none of those. CSS variables
are on `:root` / `:root.dark` in `src/index.css`. Tailwind's dark
variant is `@custom-variant dark (&:where(.dark, .dark *))`, so
portaled descendants of `html.dark` stay themed.

Live probe of Settings → AI Agents → Model:

| | Graphite | Earth light |
|---|---|---|
| html | `.dark` `data-theme=dark` `--popover:#22211F` | `data-theme=light` `data-color-theme=rhizome` `--popover:#FCFAF6` |
| #root | no theme attrs | no theme attrs |
| menu ancestors | menu → wrapper → BODY → HTML | same |
| menu background | `rgb(34, 33, 31)` padding `3.5px` | `rgb(252, 250, 246)` padding `3.5px` |
| hover (OpenAI · gpt-4.1-mini) | `rgb(63, 62, 60)` | `rgb(200, 189, 168)` |

A `document.body` portal is inside the themed `html` element. The
#175-style unstyled menu does not reproduce when app CSS is loaded.

An attempted `container={document.documentElement}` still landed under
`body` (Radix `RemoveScroll` wrapper). jsdom `body.contains` stayed
true. That change was reverted; shared `dropdown-menu.tsx` is
unchanged.

## Tests

`expectMenuInThemedPortal` asserts `html` has `data-theme` / `.dark`
(or light without `.dark`), `html.contains(menu)`, and
`body.contains(menu)`, plus the overflow-hidden/clip walk and a click
that selects a row. Earth-light coverage is in
`NativeChatModelPicker.test.tsx`.

## Screenshots

`docs/screenshots/pr-178/` rest + hover, Graphite and Earth, from the
running mock app (not a bare harness).
