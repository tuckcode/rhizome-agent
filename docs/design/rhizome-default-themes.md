# Rhizome Default Themes — "Rhizome Light" (ledger) & "Rhizome Dark" (mycelium)

**Status:** design spec, ready to implement. **Scope:** ONLY the two first-party default theme blocks in `src/index.css` — `:root, [data-theme="light"]` and `:root.dark, [data-theme="dark"]`. The 14 fixed skins in `src/themes.css` are untouched. Token **names** are preserved exactly; only **values** change. The `--accent-blue*` tokens keep their names (the accent picker depends on them) but now carry the Rhizome green as the *default* accent.

**Intent.** Rhizome's out-of-box identity stops being "white Notion with Tolaria blue" and becomes something botanical and papery: **ledger** (light) is warm-cool paper — a sage-tinted off-white canvas with slightly brighter "sheets" raised on it, deep forest-green as the working accent, and a rust-orange counterpoint for warnings and inline code. **mycelium** (dark) is deep loam — near-black green-cast ground with faintly lit panels and a phosphor-mint accent that glows against it, amber as the counterpoint. The two are siblings in hue logic (green primary, warm-orange secondary, green-gray neutrals) but are designed independently — dark is not an inversion of light.

---

## 1. Light default — "Rhizome Light" (ledger)

Block: `:root, [data-theme="light"]` (~line 33). `color-scheme: light` unchanged.

### Surfaces

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--surface-app` | `#FFFFFF` | `#EFF1EC` | Anchor. The canvas is tinted paper, never pure white — this is the single biggest identity shift. |
| `--surface-sidebar` | `#F7F6F3` | `#E9ECE5` | Anchor (recessed). Sidebar sits *below* the canvas, one step deeper into the paper. |
| `--surface-panel` | `#FFFFFF` | `#F7F8F5` | Anchor (raised). Panels are brighter sheets laid on the canvas. |
| `--surface-card` | `#FFFFFF` | `#F7F8F5` | Same elevation as panel. |
| `--surface-popover` | `#FFFFFF` | `#FBFCFA` | Highest elevation — one step brighter than card so popovers separate without heavy shadows. |
| `--surface-input` | `#FFFFFF` | `#FBFCFA` | Inputs read as bright "wells" against tinted surrounds; on tinted paper, lighter = focusable. |
| `--surface-button` | `#EBEBEA` | `#E3E7DE` | Neutral button chip, green-gray instead of warm gray. |
| `--surface-dialog` | `#FFFFFF` | `#F9FAF7` | Between panel and popover. |
| `--surface-editor` | `#FFFFFF` | `#EFF1EC` | **Deliberately equal to `--surface-app`** — code and layout assume editor and app share a plane; a visible seam between them would look broken. |
| `--surface-overlay` | `rgba(0, 0, 0, 0.3)` | `rgba(26, 30, 22, 0.3)` | Scrim warmed toward ink instead of pure black. |

### Text

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--text-primary` | `#37352F` | `#23281F` | Anchor ink. Green-black, ~13.3:1 on canvas. |
| `--text-secondary` | `#787774` | `#4C5546` | New real step (current theme collapsed secondary=tertiary). ~6.8:1 — AA for body-size UI copy. |
| `--text-tertiary` | `#787774` | `#616A59` | ~4.9:1, still AA. De-emphasized labels, metadata. |
| `--text-muted` | `#B4B4B4` | `#77806E` | Anchor muted. ~3.6:1 — decorative/supporting only, but a big legibility upgrade over the current 2.4:1 gray. |
| `--text-faint` | `#B4B4B4` | `#97A08D` | Placeholders, ghost text (~2.5:1, intentionally sub-AA like today). |
| `--text-heading` | `#37352F` | `#1B2017` | One notch deeper than body so headings feel set, not colored. |
| `--text-inverse` | `#FFFFFF` | `#F7F8F5` | Paper-white, not pure white — text on filled accent buttons stays in-family. |

### Borders

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--border-default` | `#E9E9E7` | `#D6DBCF` | Anchor hairline. |
| `--border-subtle` | `#E9E9E7` | `#E1E5DA` | Now genuinely subtler than default (currently identical). |
| `--border-strong` | `#D9D9D6` | `#C2C9B8` | |
| `--border-input` | `#E9E9E7` | `#CBD2C2` | Slightly stronger than default so input wells hold shape on tinted paper. |
| `--border-dialog` | `#E9E9E7` | `#D6DBCF` | = default. |
| `--border-focus` | `#155DFF` | `#2E6B4F` | Rhizome green. |

### Interaction states

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--state-hover` | `#EBEBEA` | `#E5E9DF` | Neutral (green-gray) hover — hover stays achromatic-feeling; only *selection* gets the accent tint. |
| `--state-hover-subtle` | `#F0F0EF` | `#EBEEE6` | |
| `--state-selected` | `#E8F4FE` | `#DFE9E2` | Green-tinted selection wash (≈ accent at 10% over paper) replacing the blue wash. |
| `--state-selected-strong` | `#D8ECFE` | `#CFDFD4` | |
| `--state-active` | `#E8F4FE` | `#DFE9E2` | = selected, mirroring current pattern. |
| `--state-focus-ring` | `#155DFF` | `#2E6B4F` | |
| `--state-drag-target` | `#155DFF18` | `#2E6B4F18` | Keep the 8-digit-hex alpha pattern. |
| `--state-disabled` | `#F0F0EF` | `#EBEEE6` | = hover-subtle, as today. |

### Accent roles

`--accent-blue*` is the **default user-overridable accent** — name stays, value becomes Rhizome green.

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--accent-blue` | `#155DFF` | `#2E6B4F` | Anchor. Deep forest green, ~5.5:1 on canvas — AA as text/link color. |
| `--accent-blue-bg` | `#155DFF18` | `#2E6B4F18` | |
| `--accent-blue-hover` | `#0D4AD6` | `#245741` | Darken on hover (light-mode convention preserved). |
| `--accent-blue-light` | `#155DFF14` | `#2E6B4F14` | |
| `--accent-green` | `#38A169` | `#38A169` | **Kept.** Type-color green must stay distinguishable from the default accent; the brighter mint reads as a separate swatch and success-green semantics are unharmed. |
| `--accent-green-light` | `rgba(56, 161, 105, 0.1)` | `rgba(56, 161, 105, 0.1)` | Kept. |
| `--accent-orange` | `#D9730D` | `#B4552D` | Anchor secondary/warn. Rust replaces pumpkin; 4.3:1 on canvas (AA-large; fine for badges/icons — body-copy warning text uses the darker `--feedback-warning-text`). |
| `--accent-orange-light` | `rgba(217, 115, 13, 0.1)` | `rgba(180, 85, 45, 0.12)` | |
| `--accent-red` | `#E53E3E` | `#C03D30` | Earthier brick red — fits the palette, still unambiguous danger. |
| `--accent-red-light` | `rgba(229, 62, 62, 0.1)` | `rgba(192, 61, 48, 0.1)` | |
| `--accent-purple` | `#805AD5` | `#7C5CB8` | Slightly desaturated to sit on sage paper. |
| `--accent-purple-light` | `rgba(128, 90, 213, 0.1)` | `rgba(124, 92, 184, 0.1)` | |
| `--accent-yellow` | `#D69E2E` | `#B08A25` | Darkened toward ochre so it survives on tinted paper. |
| `--accent-yellow-light` | `rgba(214, 158, 46, 0.1)` | `rgba(176, 138, 37, 0.12)` | |
| `--accent-teal` | `#319795` | `#2E7D78` | One step deeper for contrast on tint. |
| `--accent-teal-light` | `rgba(49, 151, 149, 0.1)` | `rgba(46, 125, 120, 0.1)` | |
| `--accent-pink` | `#D53F8C` | `#B84A7E` | Muted rose. |
| `--accent-pink-light` | `rgba(213, 63, 140, 0.1)` | `rgba(184, 74, 126, 0.1)` | |
| `--accent-gray` | `#718096` | `#6E7867` | Blue-gray → green-gray; the neutral swatch belongs to the same family as the paper. |
| `--accent-gray-light` | `rgba(113, 128, 150, 0.1)` | `rgba(110, 120, 103, 0.1)` | |

### Feedback roles

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--feedback-info-text` | `var(--accent-blue)` | `var(--accent-blue)` | **Kept as alias** — follows the (now green) default accent and the accent picker. |
| `--feedback-info-bg` | `var(--accent-blue-light)` | `var(--accent-blue-light)` | Kept as alias. |
| `--feedback-success-text` | `var(--accent-green)` | `var(--accent-green)` | Kept as alias. |
| `--feedback-success-bg` | `var(--accent-green-light)` | `var(--accent-green-light)` | Kept as alias. |
| `--feedback-warning-text` | `#92400E` | `#8A4A16` | Warm brown harmonized with the rust accent; ~6:1 on its bg. |
| `--feedback-warning-bg` | `#FEF3C7` | `#F2E8CE` | Parchment wash instead of lemon — lemon clashes with sage paper. |
| `--feedback-warning-border` | `#D97706` | `#B4552D` | = rust accent. |
| `--feedback-error-text` | `var(--accent-red)` | `var(--accent-red)` | Kept as alias. |
| `--feedback-error-bg` | `var(--accent-red-light)` | `var(--accent-red-light)` | Kept as alias. |

### Syntax & diff roles

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--syntax-heading` | `#0969DA` | `#2E6B4F` | Markdown headings take the brand green. |
| `--syntax-link` | `#0969DA` | `#2E6B4F` | Wikilinks/links green. (Static token — see Open questions re: accent picker.) |
| `--syntax-monospace` | `#C9383E` | `#B4552D` | Inline code in rust — the ledger's second voice. |
| `--syntax-monospace-bg` | `rgba(175, 184, 193, 0.15)` | `rgba(119, 128, 110, 0.14)` | Green-gray wash. |
| `--syntax-muted` | `#636C76` | `#616A59` | = `--text-tertiary` value. |
| `--syntax-frontmatter-key` | `#C9383E` | `#B4552D` | |
| `--syntax-frontmatter-value` | `#2A7E4F` | `#2E6B4F` | |
| `--syntax-highlight-comment` | `#6A737D` | `#77806E` | |
| `--syntax-highlight-keyword` | `#D73A49` | `#A6403C` | Brick, matched to `--accent-red` family. |
| `--syntax-highlight-string` | `#032F62` | `#23503C` | Deep pine — strings go green instead of navy. |
| `--syntax-highlight-number` | `#005CC5` | `#2E6E7D` | Quiet blue-teal; keeps numbers distinct without reintroducing brand blue. |
| `--syntax-highlight-title` | `#6F42C1` | `#6B4FA3` | |
| `--syntax-highlight-type` | `#E36209` | `#96551F` | |
| `--syntax-highlight-deletion` | `#B31D28` | `#A8322E` | |
| `--syntax-highlight-deletion-bg` | `#FFEEF0` | `#F5E2DE` | |
| `--diff-added-text` | `#4CAF50` | `#2F7D4F` | Darker for AA on tinted paper. |
| `--diff-added-bg` | `rgba(76, 175, 80, 0.12)` | `rgba(47, 125, 79, 0.12)` | |
| `--diff-removed-text` | `#F44336` | `#BF4136` | |
| `--diff-removed-bg` | `rgba(244, 67, 54, 0.12)` | `rgba(191, 65, 54, 0.12)` | |
| `--diff-hunk-bg` | `rgba(33, 150, 243, 0.08)` | `rgba(46, 107, 79, 0.08)` | Blue tint → green tint. |
| `--editor-code-block-background` | `var(--surface-sidebar)` | `var(--surface-sidebar)` | **Kept as alias** — resolves to the new recessed paper automatically. |
| `--editor-code-block-border` | `var(--border-subtle)` | `var(--border-subtle)` | Kept as alias. |
| `--editor-code-block-text` | `var(--text-primary)` | `var(--text-primary)` | Kept as alias. |
| `--editor-code-block-language` | `var(--text-secondary)` | `var(--text-secondary)` | Kept as alias. |

### Overlays, shadcn aliases, compatibility aliases

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--shadow-overlay` | `var(--surface-overlay)` | `var(--surface-overlay)` | Kept as alias. |
| `--shadow-dialog` | `rgba(0, 0, 0, 0.15)` | `rgba(26, 30, 22, 0.15)` | Warmed to ink. |
| `--radius` | `0.5rem` | `0.5rem` | **Kept** — geometry is out of scope. |
| `--background` … `--sidebar-ring` (shadcn block, 27 tokens) | all `var(...)` | **unchanged** | Pure aliases; they inherit the new palette automatically. |
| `--bg-primary` … `--link-hover` (compat block, 13 tokens) | all `var(...)` | **unchanged** | Pure aliases. |

---

## 2. Dark default — "Rhizome Dark" (mycelium)

Block: `:root.dark, [data-theme="dark"]` (~line 185). `color-scheme: dark` unchanged.

### Surfaces

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--surface-app` | `#1F1E1B` | `#0E120C` | Anchor. Deep loam — darker and greener than Tolaria's warm charcoal. |
| `--surface-sidebar` | `#191814` | `#10150E` | Anchor (recessed). Barely off the canvas; the sidebar reads as the same soil, faintly lit. |
| `--surface-panel` | `#23221F` | `#151A12` | Anchor (raised). |
| `--surface-card` | `#23221F` | `#151A12` | = panel. |
| `--surface-popover` | `#292823` | `#1B2117` | One elevation step above card. |
| `--surface-input` | `#1F1E1B` | `#0E120C` | Inputs = app plane (current pattern preserved: dark inputs are recessed wells). |
| `--surface-button` | `#34322D` | `#222A1C` | |
| `--surface-dialog` | `#272622` | `#181E14` | Between card and popover. |
| `--surface-editor` | `#1F1E1B` | `#0E120C` | = app, same seam rationale as light. |
| `--surface-overlay` | `rgba(8, 8, 7, 0.58)` | `rgba(4, 6, 3, 0.6)` | |

### Text

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--text-primary` | `#E6E1D8` | `#E6EBE0` | Anchor ink, cooled from cream to sage-white. ~15:1. |
| `--text-secondary` | `#B8B1A6` | `#ADB6A3` | ~8.7:1. |
| `--text-tertiary` | `#9C9488` | `#929C86` | ~6.3:1. |
| `--text-muted` | `#7F776D` | `#79836F` | Anchor muted. ~4.6:1 — passes AA even at muted. |
| `--text-faint` | `#625B53` | `#5C6553` | Placeholders (~2.9:1, intentionally sub-AA like today). |
| `--text-heading` | `#F1ECE3` | `#F2F6ED` | |
| `--text-inverse` | `#151411` | `#0E120C` | = app bg, so dark-on-phosphor buttons match the ground. |

### Borders

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--border-default` | `#34322D` | `#232A1F` | Anchor hairline. |
| `--border-subtle` | `#2A2925` | `#1A2016` | |
| `--border-strong` | `#46433B` | `#333D2B` | |
| `--border-input` | `#3A3832` | `#2A3224` | |
| `--border-dialog` | `#3A3832` | `#2A3224` | |
| `--border-focus` | `#78A4FF` | `#6FE3A0` | Phosphor. |

### Interaction states

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--state-hover` | `#2D2B27` | `#1B2117` | Neutral lift (= popover plane). |
| `--state-hover-subtle` | `#262520` | `#161C12` | |
| `--state-selected` | `#1E344C` | `#1B2E22` | Dark moss wash — green-tinted, clearly separable from neutral hover. |
| `--state-selected-strong` | `#25415F` | `#223A2B` | |
| `--state-active` | `#203A55` | `#1E3326` | |
| `--state-focus-ring` | `#78A4FF` | `#6FE3A0` | |
| `--state-drag-target` | `rgba(120, 164, 255, 0.2)` | `rgba(111, 227, 160, 0.18)` | |
| `--state-disabled` | `#292824` | `#161B12` | |

### Accent roles

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--accent-blue` | `#78A4FF` | `#6FE3A0` | Anchor. Phosphor mint, ~11.5:1 on the ground — glows without shouting. |
| `--accent-blue-bg` | `rgba(120, 164, 255, 0.2)` | `rgba(111, 227, 160, 0.18)` | |
| `--accent-blue-hover` | `#9BBEFF` | `#8FEBB4` | Lighten on hover (dark-mode convention preserved). |
| `--accent-blue-light` | `rgba(120, 164, 255, 0.16)` | `rgba(111, 227, 160, 0.14)` | |
| `--accent-green` | `#79D89D` | `#9BCF7E` | Shifted to leaf/chartreuse so the type-color green stays distinguishable from the phosphor default accent (current `#79D89D` would be nearly identical to it). |
| `--accent-green-light` | `rgba(121, 216, 157, 0.16)` | `rgba(155, 207, 126, 0.16)` | |
| `--accent-orange` | `#F3A15B` | `#E0A458` | Anchor secondary/warn amber. |
| `--accent-orange-light` | `rgba(243, 161, 91, 0.17)` | `rgba(224, 164, 88, 0.16)` | |
| `--accent-red` | `#FF8A86` | `#E8837C` | Softened toward loam; still ~5.9:1. |
| `--accent-red-light` | `rgba(255, 138, 134, 0.16)` | `rgba(232, 131, 124, 0.16)` | |
| `--accent-purple` | `#B69CFF` | `#B4A0E8` | Slightly desaturated. |
| `--accent-purple-light` | `rgba(182, 156, 255, 0.17)` | `rgba(180, 160, 232, 0.16)` | |
| `--accent-yellow` | `#F2C86B` | `#E4C97A` | Nudged toward straw. |
| `--accent-yellow-light` | `rgba(242, 200, 107, 0.18)` | `rgba(228, 201, 122, 0.16)` | |
| `--accent-teal` | `#64D1C8` | `#64D1C8` | **Kept** — already reads well on the loam and is well-spaced from both greens. |
| `--accent-teal-light` | `rgba(100, 209, 200, 0.16)` | `rgba(100, 209, 200, 0.16)` | Kept. |
| `--accent-pink` | `#F28AC3` | `#E594BB` | Muted rose. |
| `--accent-pink-light` | `rgba(242, 138, 195, 0.16)` | `rgba(229, 148, 187, 0.16)` | |
| `--accent-gray` | `#A7B0BD` | `#9AA491` | Blue-gray → green-gray. |
| `--accent-gray-light` | `rgba(167, 176, 189, 0.14)` | `rgba(154, 164, 145, 0.14)` | |

### Feedback roles

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--feedback-info-text` | `var(--accent-blue)` | `var(--accent-blue)` | Kept as alias (follows default/user accent). |
| `--feedback-info-bg` | `var(--accent-blue-light)` | `var(--accent-blue-light)` | Kept as alias. |
| `--feedback-success-text` | `var(--accent-green)` | `var(--accent-green)` | Kept as alias. |
| `--feedback-success-bg` | `var(--accent-green-light)` | `var(--accent-green-light)` | Kept as alias. |
| `--feedback-warning-text` | `#F5C36B` | `#E0A458` | = amber accent; one warning voice, not two competing yellows. |
| `--feedback-warning-bg` | `rgba(245, 195, 107, 0.16)` | `rgba(224, 164, 88, 0.14)` | |
| `--feedback-warning-border` | `#D99B3D` | `#B87F35` | |
| `--feedback-error-text` | `var(--accent-red)` | `var(--accent-red)` | Kept as alias. |
| `--feedback-error-bg` | `var(--accent-red-light)` | `var(--accent-red-light)` | Kept as alias. |

### Syntax & diff roles

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--syntax-heading` | `#83B2FF` | `#6FE3A0` | Headings glow phosphor. |
| `--syntax-link` | `#83B2FF` | `#6FE3A0` | |
| `--syntax-monospace` | `#FFA6A3` | `#E0A458` | Inline code in amber — terminal-phosphor pairing. |
| `--syntax-monospace-bg` | `rgba(167, 176, 189, 0.16)` | `rgba(121, 131, 111, 0.16)` | |
| `--syntax-muted` | `#9C9488` | `#929C86` | = `--text-tertiary` value. |
| `--syntax-frontmatter-key` | `#FFA6A3` | `#E0A458` | |
| `--syntax-frontmatter-value` | `#8EDFAE` | `#8CDFA6` | |
| `--syntax-highlight-comment` | `#8E877D` | `#6E7863` | |
| `--syntax-highlight-keyword` | `#FF9BA0` | `#E8938A` | |
| `--syntax-highlight-string` | `#A9D6FF` | `#A5D8C8` | Ice blue → seafoam. |
| `--syntax-highlight-number` | `#8BB7FF` | `#8FBEDB` | Muted sky; numbers keep a distinct cool voice. |
| `--syntax-highlight-title` | `#C2AAFF` | `#C3B2F0` | |
| `--syntax-highlight-type` | `#F3B175` | `#E5B171` | |
| `--syntax-highlight-deletion` | `#FF9C9A` | `#E8938A` | |
| `--syntax-highlight-deletion-bg` | `rgba(255, 138, 134, 0.16)` | `rgba(232, 131, 124, 0.15)` | |
| `--diff-added-text` | `#79D89D` | `#6FE3A0` | |
| `--diff-added-bg` | `rgba(121, 216, 157, 0.14)` | `rgba(111, 227, 160, 0.13)` | |
| `--diff-removed-text` | `#FF8A86` | `#E8837C` | |
| `--diff-removed-bg` | `rgba(255, 138, 134, 0.14)` | `rgba(232, 131, 124, 0.14)` | |
| `--diff-hunk-bg` | `rgba(120, 164, 255, 0.13)` | `rgba(224, 164, 88, 0.12)` | Hunk headers go amber so they never blur into added-green. |
| `--editor-code-block-background` | `#161616` | `#0A0D08` | Darker-than-canvas well, tinted to the loam instead of neutral black. |
| `--editor-code-block-border` | `transparent` | `transparent` | **Kept** — dark code blocks separate by depth, not stroke. |
| `--editor-code-block-text` | `#FFFFFF` | `#E6EBE0` | Match primary ink; pure white sparkles too hard on deep ground. |
| `--editor-code-block-language` | `rgba(255, 255, 255, 0.7)` | `rgba(230, 235, 224, 0.65)` | |

### Overlays, shadcn aliases, compatibility aliases

| Token | Current | Proposed | Note |
|---|---|---|---|
| `--shadow-overlay` | `var(--surface-overlay)` | `var(--surface-overlay)` | Kept as alias. |
| `--shadow-dialog` | `rgba(0, 0, 0, 0.42)` | `rgba(0, 0, 0, 0.45)` | Slightly deeper — panels are darker now, shadows must still register. |
| `--background` … `--sidebar-ring` (shadcn block) | all `var(...)` | **unchanged** | Pure aliases. |
| `--bg-primary` … `--link-hover` (compat block) | all `var(...)` | **unchanged** | Pure aliases. |

---

## 3. Taste calls

- **Why `#2E6B4F` / `#6FE3A0`.** The greens are the brand: deep enough in light mode to work as *text* (5.5:1 — links, focus rings, and labels can all use the raw accent, which Tolaria blue also allowed), and in dark mode bright enough to read as bioluminescence against near-black loam without the neon scream of a pure `#00FF88`. They are not tints of each other — each was chosen against its own ground.
- **How much warmth in the paper.** `#EFF1EC` is ~2% green-shifted off neutral — enough that white panels (`#F7F8F5`) visibly "lift" and screenshots are recognizably Rhizome, not enough to tint note content or photos. The elevation story does the work borders used to do: recessed sidebar → canvas → raised sheets → popover, four planes, ~4 L* steps apart.
- **Hover is neutral, selection is green.** Hover states stay green-gray (no accent), so the accent tint is reserved for *meaning* (selected note, active tab). This also keeps hover sane when the user re-picks the accent color: only selected/active/focus carry accent identity.
- **Rust/amber as the second voice.** `#B4552D` (light) / `#E0A458` (dark) carry warnings, inline code, and frontmatter keys. Green+rust is the ledger conceit (ink + rubrication); mint+amber is the terminal-phosphor conceit. One warm counterpoint everywhere means warnings never introduce a third hue system.
- **Focus ring = accent, both modes.** `--border-focus` and `--state-focus-ring` both track the default accent. When the user overrides the accent via the picker, focus identity follows `--ring`/`--primary` aliases automatically.
- **Dark is not inverted light.** Dark selection is a moss *shadow* (`#1B2E22`), not a lightened green; dark inputs are recessed wells (= app plane) while light inputs are bright wells (above panel plane). Each mode keeps its native elevation logic.
- **Muted-text legibility quietly improves.** Light `--text-muted` goes from 2.4:1 gray to 3.6:1 green-gray; dark muted lands at 4.6:1. Same visual "quietness," less squinting.
- **Type-color spacing.** With green as the default accent, the `--accent-green` swatch was the collision risk: kept as brighter mint in light, shifted to leaf-chartreuse `#9BCF7E` in dark so users can still tell "my accent" from "the green type."

## 4. Contrast check (WCAG, approximate ratios)

| Pair | Light | Dark | Verdict |
|---|---|---|---|
| Primary text on app bg | `#23281F` / `#EFF1EC` ≈ **13.3:1** | `#E6EBE0` / `#0E120C` ≈ **15.0:1** | AAA |
| Secondary text on app bg | `#4C5546` ≈ **6.8:1** | `#ADB6A3` ≈ **8.7:1** | AA+ |
| Tertiary text on app bg | `#616A59` ≈ **4.9:1** | `#929C86` ≈ **6.3:1** | AA |
| Muted text on app bg | `#77806E` ≈ **3.6:1** | `#79836F` ≈ **4.6:1** | AA-large / decorative (light); AA (dark) |
| Default accent on app bg | `#2E6B4F` ≈ **5.5:1** | `#6FE3A0` ≈ **11.5:1** | AA / AAA |
| Inverse text on accent (filled button) | `#F7F8F5` on `#2E6B4F` ≈ **5.9:1** | `#0E120C` on `#6FE3A0` ≈ **11.5:1** | AA / AAA |
| Warn accent on app bg | `#B4552D` ≈ **4.3:1** | `#E0A458` ≈ **8.3:1** | AA-large (light — body warning copy uses `#8A4A16` at ≈6:1 on its bg); AA+ (dark) |
| Primary text on raised card | `#23281F` / `#F7F8F5` ≈ **14.2:1** | `#E6EBE0` / `#151A12` ≈ **13.2:1** | AAA |

Ratios computed from relative luminance; implementer should spot-verify with a checker after paste, but every body-copy pairing clears 4.5:1 and every decorative pairing clears 3:1 except `--text-faint` (placeholder-only, matching current behavior).

## 5. Open questions for review

1. **`--syntax-link` / `--syntax-heading` don't follow the accent picker.** They are literal values, so a user who picks (say) purple gets purple UI chrome but green wikilinks in the editor. Same gap exists today with blue. Acceptable for this pass, or should the implementer switch these two to `var(--accent-blue)` while in the file? (One-line change, keeps names.)
2. **Editor plane.** Spec keeps `--surface-editor` = `--surface-app` to avoid seams. If the "note as raised sheet" look is wanted (editor `#F7F8F5` on `#EFF1EC` canvas), that's a deliberate product decision needing layout QA — flag before adopting.
3. **Light `--text-faint` at ~2.5:1** is sub-AA by design (matches current placeholder behavior). Confirm no essential copy uses `--text-faint`.
4. **`:root[data-accent=…]` override blocks** (below the dark block) reference these tokens by name and are untouched — but the "blue" choice in the accent picker UI now effectively means "Rhizome green." If the picker shows a blue swatch for the default, the picker UI (not CSS tokens) needs its swatch color updated to `#2E6B4F` / `#6FE3A0` in a follow-up task.
