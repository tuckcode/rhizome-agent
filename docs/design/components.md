# Components

**Origin:** Cursor Grok 4.6 · 2026-10-11 · notes checked against `src/components/ui/*.tsx` and `src/components/BrandMark.tsx` on `main` at `7997dee`. Adapted from the Oct 4 design-system export, then corrected where the export drifted.

Use the shadcn control in `src/components/ui/`. Do not add a raw `<button>`, `<input>`, `<select>`, `<textarea>`, or `type="date"` for user-facing UI. Search `src/components/` before building a new control. Product name in this file is **Rhizome**.

## Button

`src/components/ui/button.tsx`. Variants: `default` (solid `primary`), `destructive`, `outline`, `secondary`, `ghost`, `link`. Sizes: `default` (`h-9`), `xs`, `sm`, `lg`, `icon` (`size-9`), `icon-xs` (`size-7`), `icon-sm`, `icon-lg`. Destructive is opaque `bg-destructive` with `hover:bg-destructive/95`. There is no `dark:bg-destructive/60` class; do not document a 60% dark fill. Focus is the shared 3px `ring/50` halo. Disabled is `opacity-50` and no pointer events.

## Badge

`src/components/ui/badge.tsx`. Pill (`rounded-full`), `text-xs`. Variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`. Destructive matches the button treatment (opaque fill, hover `/95`, no 60% dark fill). Focus is the 3px halo. `asChild` is available through the Radix Slot.

## Input

`src/components/ui/input.tsx`. Height `h-9`, `rounded-md` (5px), `border-input`. Placeholder uses `text-muted-foreground` (alias of `text-secondary`). New hint copy should still follow `text-faint` in [`ui-rules.md`](ui-rules.md). Focus is the 3px halo. `spellCheck` is false and `autoComplete` is `off`; IME `autocorrect` / `autocapitalize` stay unset.

## Textarea

`src/components/ui/textarea.tsx`. Same border, placeholder, selection, focus halo, and native-assistance props as Input. Minimum height `min-h-20`. `md:text-sm` on wide viewports; `text-base` below that.

## Checkbox

`src/components/ui/checkbox.tsx`. Native checkbox, `appearance-none`, `size-4`, corner `rounded-[4px]` (not the 3/5/7/11 ladder). Checked fill is `primary` with a Phosphor `Check`. `checked` may be `true`, `false`, or `'indeterminate'` (`aria-checked="mixed"`). The check glyph renders only when `checked === true`. Focus is the 3px halo.

## Switch

`src/components/ui/switch.tsx`. `role="switch"` on a `button`, `h-5 w-9`, thumb `size-4`. On is `bg-primary`; off is `bg-input`. There is no `ToggleGroup` in `src/components/ui/`. Focus is the 3px halo.

## Select

`src/components/ui/select.tsx`. Trigger sizes `default` (`h-9`) and `sm` (`h-8`), `rounded-md`, 3px focus halo. Content portals at `z-[12000]`. Items highlight with `focus:bg-accent focus:text-accent-foreground`, not `border-strong`. The selected value shows a Phosphor check on the right. Placeholder text is `text-muted-foreground`.

## Calendar

`src/components/ui/calendar.tsx`. `react-day-picker` with dropdown month/year (`Select`), range 1900–2100. Day cells are ghost `Button`s. A single selected day and range ends use `primary`; today and range middle use `accent`. Focused day gets the 3px halo. Do not add a native `input type="date"`.

## Tabs

`src/components/ui/tabs.tsx`. List variants: `default` (muted pill track, `h-9`) and `line` (underline on the active trigger). Triggers keep the 3px halo. Active default-variant trigger is `bg-background` with a light shadow.

## Card

`src/components/ui/card.tsx`. `bg-card`, `rounded-xl` (11px at the 14px root), `py-6`, `gap-6`, `shadow-sm`. Slots: `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`. This is larger than `--radius-lg` (7px). Do not document cards as 7px.

## Separator

`src/components/ui/separator.tsx`. `bg-border`, 1px. `decorative` defaults to true. Horizontal is full width; vertical is full height.

## ScrollArea

`src/components/ui/scroll-area.tsx`. Viewport keeps the 3px focus halo. Thumb is `bg-border`, `rounded-full`. Vertical bar is `w-2.5`; horizontal is `h-2.5`.

## Dialog

`src/components/ui/dialog.tsx`. Overlay and content sit at `z-[1400]`. Overlay is `bg-black/50`. Content is `rounded-lg` (7px), `sm:max-w-lg`, centered. Close X is optional (`showCloseButton`, default true) with a visually hidden "Close" label; that button uses a 2px ring plus 2px offset, not the 3px halo. Footer can render an outline Close when `showCloseButton` is set on `DialogFooter`.

## Popover

`src/components/ui/popover.tsx`. Content portals at `z-[12000]`, default width `w-72`, `rounded-md`, `p-4`, `outline-hidden`. Default `sideOffset` is 4 and `collisionPadding` is 8. Slots: `PopoverHeader`, `PopoverTitle`, `PopoverDescription`. Pair with `Calendar` for a date picker.

## DropdownMenu

`src/components/ui/dropdown-menu.tsx`. Content is `z-50`, `rounded-md`, `p-1`. `DropdownMenuItem` highlights with `border-strong` (`focus` and `data-[highlighted]`). Checkbox items, radio items, and subtriggers highlight with `accent`. Destructive items use `text-destructive` and a tinted destructive focus fill. Shortcut text is `text-muted-foreground`, `text-xs`, wide tracking.

## Tooltip

`src/components/ui/tooltip.tsx`. Inverted chip: `bg-foreground text-background`, `text-xs`, `rounded-md`. Provider `delayDuration` defaults to 0. Content has no enter/exit animation classes (see `overlayPresence.test.tsx`). A tooltip is extra; it is not an accessible name.

## ActionTooltip

`src/components/ui/action-tooltip.tsx`. Wraps `Tooltip` and shows `copy.label` plus an optional `copy.shortcut` chip. Default side is `top`, `sideOffset` 6. An error boundary falls back to the child control so a tooltip failure cannot hide the action. Still put `aria-label` on icon-only children.

## BrandMark

`src/components/BrandMark.tsx`. Current mark is the six-node 3c Network (one core + five satellites). Core fill is `--primary`, not `--accent-blue`, so the accent picker keeps working. Satellites and links use `--text-primary` and `--text-muted`. A dithered root-line mark is planned and is not in the app yet. Do not swap the six-node mark until that work lands.
