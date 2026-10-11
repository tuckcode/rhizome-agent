# UI rules

**Origin:** Cursor Grok 4.6 · 2026-10-11 · living rules for coding agents. Describes the shipped app on `main` at `7997dee`.

Read this before UI work. Then read [`components.md`](components.md) for the control you are touching, and [`earth-theme/DESIGN.md`](earth-theme/DESIGN.md) for color and type direction. Values live in `src/index.css` and `src/themes.css`. Do not copy hex from this page into a component.

## Role tokens, no raw hex

Paint with role tokens from `src/index.css` (`surface-*`, `text-*`, `border-*`, `state-*`, `feedback-*`, `syntax-*`, `diff-*`, `editor-code-block-*`, `accent-*`). Never write a raw hex, `rgb()`, or `hsl()` in a component. Earth's rationale is in [`earth-theme/DESIGN.md`](earth-theme/DESIGN.md). `src/themes.css` holds the fixed skins (Loam and the rest). The CSS is the source of truth; a design-export token file is not.

## Brand UI binds to `primary`

Brand-colored UI uses `primary` (or `sidebar-primary` and `link-color`), not `accent-blue`. `--accent-blue` is a fixed per-theme token. The Rhizome accent picker rebinds `--primary` through `:root[data-accent="…"]` in `src/index.css`. Binding to `accent-blue` silently ignores that picker. `--primary` defaults to `var(--accent-blue)` when no accent is set, so `primary` is correct in every theme.

## Earth text tiers

Every text token, including `text-muted` and `text-faint`, passes 4.5:1 on every surface of its scheme. CI enforces that with `scripts/contrast_check.py` (workflow step "Theme contrast check"). Placeholders use `text-muted-foreground` (as `Input` and `Textarea` already do). Use `text-faint` for disabled text only. Use border tokens (`border`, `border-subtle`, `border-strong`), not faded text, for decorative lines. Informational text is 11px minimum. 10px is only for a decorative kicker that repeats information shown elsewhere.

## Keep the focus ring

Every interactive control keeps a visible focus ring. The shipped shadcn halo is `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`. `--ring` aliases `--state-focus-ring`. The one exception is the dialog close X in `src/components/ui/dialog.tsx`: `focus:ring-2 focus:ring-offset-2` (2px ring + 2px offset). Never remove a ring with `outline: none` or `ring-0` unless you replace it with an equivalent ring.

## State-true copy

A label claims only what is known.

- A requested stop is not "Stopped". Wait until the engine reports the stop.
- A saved key is not "Connected". Configured credentials do not prove a live connection.
- An empty or failed turn gets no success badge.
- Errors give a brief cause and the one recovery action that exists, and keep the draft.
- "Working" and "Queued" wait until the engine reports them. A pulse reinforces a label. It does not create the state.
- Color never carries meaning alone. Pair status with a glyph or a word.

Hardcode English strings. Do not add `en.json` keys (C18).

## Sizing at the 14px root

`:root` is 14px, so rem utilities render at 87.5% of the name (`h-9` is 31.5px, not 36px). Icon-only buttons are at least `icon-xs` (`size-7`, 24.5px) and need an `aria-label`. A tooltip alone is not a label. Do not raise the root size to "fix" a control; pick a size token that still hits after the 87.5% scale.

Radii at this root: `--radius-sm` 3px, `--radius-md` 5px, `--radius-lg` 7px, `--radius-xl` 11px. Inputs and buttons use `rounded-md` (5px). Dialogs use `rounded-lg` (7px). Cards use `rounded-xl` (11px).
