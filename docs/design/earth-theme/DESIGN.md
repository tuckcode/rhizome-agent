# Rhizome Design System

> Category: Desktop product / agent workspace
> Surface: desktop web (Tauri shell) · default dark **Earth**, light **Earth light**, optional warm dark **Loam**
> Design system id: `user:web-prototype-design-system`
> Source project: Web Prototype (`621bdf82-31ff-4f99-9555-2cf380d245c9`) · linked code `<repo>`
> Name: the product is **Rhizome**. The repository and some identifiers are still `rhizome-agent`; don't rename paths, bundle ids or package names from this document.
> Revision: 2026-10-10 Earth palette, accessibility fixes, brand mark and graph direction. Previous palette names (Mycelium, Ledger) remain as aliases in `colors_and_type.css`.

## 1. Product Context

**Rhizome** is a desktop agent harness built around a vault. It runs its **own agent loop** (ADR-0180): chat, tools, approvals and run state belong to Rhizome. **Prime Agent and Hermes are optional engines** that can be attached; if one fails, the product falls back to the bare Rhizome loop instead of going down with it.

The center of gravity is **the vault**: a local, git-backed folder of Markdown notes that is the agent's durable memory and the single source of truth. The loop is chat → agent works through visible tools → the user **promotes** what's worth keeping into notes (an explicit, reviewable change, never auto-wiki from every turn) → the next session searches those notes and shows "From your vault" provenance. Conversation owns the room; tools appear as structured in-thread cards, not a terminal dump.

Headline views:

- **Chat**: transcript, tool cards, composer, sessions.
- **Vault**: inbox and notes, editor, wikilinks, Changes and History (git).
- **Mycelium**: the run-footprint view of what agent sessions touched across the vault. Its city-map engine is built on **Mindwalk** (MIT, © 2026 Ricko Yu). Keep that credit wherever the view is presented; Rhizome doesn't rebrand the engine.
- **Graph**: the note link graph (direction in §6).

Primary surfaces observed in source:

1. **Agent harness mock** (`rhizome-agent-desktop-ui.html`): 1440×900 window with titlebar, subhead telemetry, 48px icon rail, transcript, composer control deck, optional note split and session list.
2. **Vault workspace screenshots** (`image.png`, `image-1.png`, `image-2.png`): inbox list + note editor + AI Chat rail; force-directed knowledge graph; dark agent tool log.
3. **Product CSS** (`src/index.css`): the full light/dark semantic token contract used by the real app.

Audience: developers and power users who run agents against personal or project vaults. Density is **tooling-tight** (13px body, mono kickers, 32px controls), never marketing-spacious.

## 2. Color

Three schemes share one structure and the same mint signal. Contrast figures are WCAG ratios. "vs bg" is against `--bg`; "min" is the worst case across every surface token of that scheme: bg, surface, surface-2, surface-3, sidebar, popover, input, dialog, titlebar, tool-bg, user-bg, state-selected and state-hover.

### Default: Earth (dark)

A green-black forest floor with a subtle soil tint in surfaces and borders, plus one living mint signal.

| Role | Token | Value | Contrast vs bg / min |
|------|-------|-------|----------------------|
| Page wash | `--page-wash` | `#090A07` | |
| App background | `--bg` | `#0F110C` | |
| Panel / card | `--surface` | `#16170F` | |
| Elevated / popover | `--surface-2` | `#1C1D14` | |
| Button fill | `--surface-3` | `#23231A` | |
| Sidebar / tool card | `--surface-sidebar`, `--tool-bg` | `#121410` | |
| Selected / user bubble | `--state-selected`, `--user-bg` | `#1A2619` | |
| Heading | `--fg-heading` | `#F4F2E8` | 16.92 / 14.01 |
| Foreground | `--fg` | `#E9E8DC` | 15.41 / 12.76 |
| Secondary text | `--fg-secondary` | `#BDBAA8` | 9.72 / 8.05 |
| Tertiary text | `--fg-tertiary` | `#A8A592` | 7.65 / 6.34 |
| Muted (meta) | `--muted` | `#999784` | 6.43 / 5.33 |
| Faint (placeholder, hints) | `--muted-2` | `#8F8D7B` | 5.66 / 4.69 |
| Border | `--border` | `#2A281D` | 1.28 (decorative) |
| Subtle border | `--border-subtle` | `#1F1E16` | decorative |
| Strong border | `--border-strong` | `#3B3828` | 1.61 (decorative) |
| Input / control border | `--border-input` | `#75705C` | 3.82 vs bg · 3.19 on surface-3 |
| Accent (mint) | `--accent` | `#6FE3A0` | 11.91 / 9.86 |
| Accent hot | `--accent-hot` | `#8FEBB4` | |
| Accent on solid | `--accent-ink` | `#0F110C` | 11.91 on accent |
| OK | `--ok` | `#9BCF7E` | 10.51 / 8.70 |
| Warn (amber) | `--warn` | `#E9B04F` | 9.76 / 8.08 |
| Danger | `--danger` | `#EE8B7E` | 7.80 / 6.46 |

Tinted fills (`--ok-bg`, `--warn-bg`, `--danger-bg`, `--accent-dim`) are 12–14% alpha of their hue. Text in that hue on its own fill stays ≥ 5.7:1 over bg, surface and surface-2.

### Earth light

Paper and soil instead of cool grey-green. Use it for reading and for anyone who prefers light mode.

| Role | Token | Value | Contrast vs bg / min |
|------|-------|-------|----------------------|
| App background | `--bg` | `#F1ECE2` | |
| Panel / card | `--surface` | `#F8F5EE` | |
| Elevated | `--surface-2` | `#FCFAF6` | |
| Button fill / wash | `--surface-3`, `--page-wash` | `#E7E0D2` | |
| Sidebar | `--surface-sidebar` | `#ECE6DA` | |
| Selected / user bubble | `--state-selected`, `--user-bg` | `#E1E6DA` | |
| Heading | `--fg-heading` | `#1E1A15` | 14.69 / 13.17 |
| Foreground | `--fg` | `#2A251E` | 12.91 / 11.57 |
| Secondary text | `--fg-secondary` | `#4E473C` | 7.79 / 6.98 |
| Tertiary text | `--fg-tertiary` | `#575043` | 6.77 / 6.07 |
| Muted | `--muted` | `#625A4D` | 5.77 / 5.18 |
| Faint | `--muted-2` | `#6B6354` | 5.04 / 4.52 |
| Border | `--border` | `#DDD4C3` | 1.25 (decorative) |
| Strong border | `--border-strong` | `#C8BDA8` | 1.58 (decorative) |
| Input / control border | `--border-input` | `#857B66` | 3.55 vs bg · 3.18 on surface-3 |
| Accent (forest) | `--accent` | `#2C6A4D` | 5.44 / 4.88 |
| Accent on solid | `--accent-ink` | `#F8F5EE` | 5.89 on accent |
| OK (leaf) | `--ok` | `#3D6A1E` | 5.44 / 4.88 |
| Warn (amber-brown) | `--warn` | `#8A5208` | 5.42 / 4.86 |
| Warn fill | `--warn-bg` | `#F3E4C4` | warn text on it 5.08 |
| Danger | `--danger` | `#A3342A` | 5.79 / 5.19 |

The light warn is deliberately amber-brown: a bright amber can't pass 4.5:1 as text on paper. The amber reads through `--warn-bg`. Light ok is a leaf green so it never collides with the forest accent.

### Optional: Loam (warm dark)

An opt-in warmer dark (`data-scheme="loam"`) with rich loam-brown surfaces. Same structure, same mint. Not the default.

| Role | Token | Value | Contrast vs bg / min |
|------|-------|-------|----------------------|
| App background | `--bg` | `#15110C` | |
| Panel / card | `--surface` | `#1D1811` | |
| Elevated | `--surface-2` | `#241E15` | |
| Button fill | `--surface-3` | `#2B2419` | |
| Sidebar / tool card | `--surface-sidebar`, `--tool-bg` | `#19150F` | |
| Selected / user bubble | `--state-selected`, `--user-bg` | `#1F2719` (olive, keeps "selected = mint family") | |
| Foreground | `--fg` | `#EDE6D8` | 15.13 / 12.35 |
| Secondary text | `--fg-secondary` | `#C6BBA6` | 9.90 / 8.08 |
| Tertiary text | `--fg-tertiary` | `#B2A791` | 7.90 / 6.45 |
| Muted | `--muted` | `#A3987F` | 6.58 / 5.37 |
| Faint | `--muted-2` | `#998D74` | 5.74 / 4.55 |
| Border | `--border` | `#352C20` | 1.37 (decorative) |
| Strong border | `--border-strong` | `#4A3D2C` | 1.79 (decorative) |
| Input / control border | `--border-input` | `#8A7A62` | 4.51 vs bg · 3.68 on surface-3 · 3.57 on selected-strong |
| Accent (mint) | `--accent` | `#6FE3A0` | 11.79 / 9.62 |
| OK | `--ok` | `#A6D282` | 10.88 / 8.88 |
| Warn | `--warn` | `#EDB451` | 10.07 / 8.22 |
| Danger | `--danger` | `#F2917F` | 8.17 / 6.67 |

Don't push loam surfaces past `#2B2419`. Beyond that it reads as leather or orange and loses the forest identity.

### Other product skins

Dracula, Nord, Gruvbox and similar fixed themes may exist in the app's theme generator. They're user options, not brand. **Never use a cold pure-gray "tactical" shell as the product default.**

### Rules

- **One mint per view.** Mint marks the single most important live thing: the primary action, the running state, or the current selection. At most two mint hits in a viewport (e.g. current rail item + primary Send). Brand marks, agent avatars, chips, carets and step numbers are not mint.
- **Text tokens are text-safe.** `--fg*`, `--muted`, `--muted-2`, `--accent`, `--ok`, `--warn` and `--danger` are all ≥ 4.5:1 on every surface of their scheme, so any of them can be used for text without checking. Status text uses the status token directly; no separate "-text" variants are needed.
- **Decorative lines use borders.** Dividers, rail hints, graph edges, ascii art and other non-informational strokes use `--border`, `--border-subtle` or `--border-strong`, never a text token turned faint.
- **Controls get a visible edge.** Inputs, text areas, selects, unselected chips and toggles that are identified by their outline use `--border-input` (≥ 3:1 against the surfaces they sit on, WCAG 1.4.11). `--border` and `--border-strong` are for separating regions, not for identifying controls.
- **Color never carries meaning alone.** Status always pairs color with a glyph or word (done, running, needs vault, failed).
- Hover darkens or lightens a surface by one ladder step. **Never** mute the text color on hover.
- Selected rows use `--state-selected` plus a 2px `--accent` left bar, the same in all schemes. No mint box borders.
- Focus ring: see §7.

## 3. Typography

| Role | Stack | Notes |
|------|-------|-------|
| Display / UI | Inter, SF Pro Text, system-ui | 500 weight titles; letter-spacing −0.03em at 26px |
| Body | Inter | 13px base in harness; product CSS uses 14px root |
| Mono / telemetry | JetBrains Mono (bundled 600 woff2), IBM Plex Mono | Kickers, chips, tool names, session ids, branch and paths |

Scale (harness), which maps to the size tokens:

- **Minimum for informational text: 11px.** That covers anything a user needs to read: meta, timestamps, counts, chip labels, kbd hints and status. 10px (`--font-size-xs`) is allowed only for purely decorative kickers that repeat information shown elsewhere.
- Kicker / meta: 11px mono uppercase, 0.08–0.12em tracking
- Chip / tool path: 11–12px mono
- Button: 12px
- Body / bubble: 13px (`--font-size-base`; no 13.5px)
- Section title: 16 or 20px
- Page title: 26px display 500
- Note editor H1 (product): large Inter 600–700, `text-wrap: balance`

Use only the token sizes (10, 11, 12, 13, 14, 16, 20, 26). No half-pixel sizes. Do **not** introduce Fraunces, display serifs or gradient wordmarks. Technical labels (branch, change count, build, session id, paths) are always mono.

## 4. Spacing

4px base scale: 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48. Padding, gaps and margins land on the scale. Off-scale values (5, 6, 7, 9, 10, 11, 13, 14, 18, 22px) are drift and should be snapped.

| Region | Measure |
|--------|---------|
| Window titlebar | 40px |
| Subhead strip | 28px |
| Icon rail width | 48px |
| Rail button | 36×36 |
| Session pane | 228px |
| Transcript max width | 72ch |
| Transcript padding | 24px 32px |
| Message stack gap | 16 or 20px |
| Chip height | 24px |
| Button min height | 32px (sm 28px) |
| Composer control gap | 8px |

Density: chrome is compact; the conversation column breathes with generous vertical rhythm.

## 5. Layout & Composition

### Agent window (primary kit)

```
┌ titlebar (traffic · mark · run status · actions) ────┐
├ subhead telemetry (session · model · vault path) ────┤
│ rail │ transcript (≥55% width) │ optional note pane  │
│ 48px │                         │                     │
│      ├ composer (full width of main) ────────────────┤
```

- Conversation owns ≥ 55% of the width; the note split is secondary (default about 60/40, divider stops at 55%) and never a full takeover.
- Shell grid: `48px 1fr`, or `48px 228px 1fr` with sessions.
- Each strip has one job. Titlebar: brand + one run-status chip + New chat. Subhead: read-only telemetry. Composer chips: only things the user can change. Footer: one shortcut hint. Don't repeat the vault, model or last tool across strips.
- Artboard canvas: 1440×900 with soft 8px chrome and a deep window shadow.
- Product vault UI: left inbox list, center editor, right AI panel (collapsed by default until used); status bar shows state only (vault, branch, change count, sync, agents).

### Hierarchy

1. User and agent message content
2. Tool timeline cards (status · path · result · Open)
3. Composer meta chips (agent · model · vault · skills)
4. Window chrome / rail

## 6. Components

### Buttons

- **Default**: surface-2 fill, strong border, fg text, 8px radius
- **Primary**: solid accent fill, accent-ink text; hover → accent-hot (keep the ink). One per viewport.
- **Danger / Stop**: danger text on danger-bg; hover increases fill opacity
- **Ghost**: transparent, `--fg-secondary` text → fg on hover
- **Save / promote**: accent text on accent-dim (secondary positive). After saving: disabled "Saved" with an `--ok` check.
- Disabled: opacity 0.42, no pointer events. Never use it for a control that has an alternative action (see Composer).

### Chips

Inline mono metadata: 24px height, 1px `--border-input` edge when interactive (`--border` when static), optional status dot (working pulse, ok, err, warn) always paired with a word. `accent-edge` for the active agent. `locked` and needs-setup states use a dashed `--warn` border and `--warn` text. Expected states (no vault yet) are warn, never danger.

### Icon buttons & rail

32–36px targets, square stroke icons at 1.6 width, miter joins. Every icon-only control has a tooltip with label + shortcut. Current page: `--state-selected` fill + 2px accent bar (the rail's one mint hit).

### Tool cards

In-thread rows: icon · tool name (mono) · target · result (e.g. "3 notes · 120ms") · status word · optional Open. Done = ok, running = accent + spinner, error = danger, needs vault = warn. Open is disabled until the tool finishes. Never render tool lifecycle as plain log text.

### Messages

- User: user-bg bubble, meta "You · time"
- Assistant: agent mark in `--muted` (not mint), optional thinking disclosure, prose with wiki links `[[note]]`, stream caret when live
- Retrieval provenance: "From your vault · note · note" in `--muted` under answers that used the vault
- Message actions: small ghost buttons in order Copy · Save to vault · Fork, with Regenerate in an overflow menu

### Composer

Control deck: meta chip row → input + actions → footer kbd hint.

**While a run is busy, the input stays focusable and editable.** Send becomes Stop, and Enter steers or queues according to the engine's support. If the engine can't steer, typing still works and the text is sent when the run ends. Never disable or remove the input from the tab order; a busy composer is announced through the run-status live region, not by going inert. The input has the same visible focus ring as every other control (§7), including when it is a `textarea` or `contenteditable`.

### Titlebar

Traffic lights (decorative), brand mark, wordmark "rhizome" (mono 600), run-status chip, New chat.

### Graph (knowledge graph direction)

- **2D, local-first.** Open on the current note's neighbourhood (2 hops). "Full graph" is a toggle. Use a stable 2D layout that freezes after settling. 3D, if kept, is an opt-in "Orbit" mode.
- **Fixed orientation.** The camera never rotates during keyboard or click navigation; it pans and zooms only. Arrow keys move to the linked note in that screen direction; Tab cycles neighbours; Enter opens the note beside the graph; Esc clears the local graph, then the selection, and stops there.
- **Keys are scoped** to the focused canvas (`role="application"` with a label), never a window-level listener.
- **The selection is drawn**: an `--accent` ring on the selected node, neighbours and their edges at full opacity, the rest dimmed. Label the selection, its neighbours and the main hubs; don't rely on hover.
- **Color stays quiet.** At most about six type colors, everything else `--muted`. Edges are `--border-strong`, and relationship kinds go in the preview, not edge colour. Ghost (unwritten) notes are hidden by default.
- **The preview helps reading**: rendered first section, "Linked from / Links to" with the sentence containing each link, outline, and Open beside as the primary action.
- Search, filters and the key sit in a toolbar above the canvas; only zoom controls float on it.

## 7. Motion & Interaction

- Default transition: **140ms ease** on color, background and border
- Scheme change: 180ms on page background and color
- Working pulse: 1.2s ease-in-out opacity on live dots
- Active press: translateY(1px) on buttons (disabled under reduced motion)
- Stream caret blinks while generating
- `@media (prefers-reduced-motion: reduce)`: stop animations and drop transforms; animated art renders its final frame statically

**Focus:** every interactive element, including `textarea`, `contenteditable` composers, graph canvas and list rows, shows `:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px }`. Never `outline: none` without an equivalent ring.

**Live regions:**
- The transcript is `role="log"` with `aria-live="polite"`. A streaming message sets `aria-busy="true"` until it completes.
- One visually hidden `role="status"` region announces run changes, throttled: tool started or finished, run complete, stopped, needs approval.
- Errors that block the user use `role="alert"`.

Hover never reduces text contrast. Focus-visible always shows the ring.

## 8. Voice & Brand

- Product name: **Rhizome** (formerly Rhizome Agent; the repo is still `rhizome-agent`). In the UI wordmark: lowercase "rhizome", JetBrains Mono 600.
- Agent: the Rhizome loop by default. Name an optional engine (Prime, Hermes) only where it matters, e.g. the engine picker or a provenance line ("Written with Prime").
- Tone: precise operator prose. Short, concrete, tool-aware.
- Capitalization: sentence case UI; mono kickers UPPERCASE
- Terminology: vault, note, promote, skills, session, tools (`search_notes`, `get_note`), Changes, History, Graph, Mycelium. Use one verb for keeping something; "Save to vault" in the UI, "promote" in docs and tool names.
- Prefer real paths and session ids (`sess_7f2a`, `wiki/decisions/…`) over lorem
- Avoid hype ("revolutionary AI"); show state ("Running tools · 1", "Idle")
- Don't ship designer annotations as product copy, or raw placeholders ("—") as values

### Brand mark

- The mark is an **asymmetric grown root line**: a single line that branches unevenly the way a rhizome spreads, with one node, ending in a flat dot. It's not a symmetric star, molecule or network badge.
- **Flat**: one color (mint on dark, forest on light, or `--fg` mono), no gloss, no 3D, no gradients, no glow, no bevel. Must read at 16px.
- **Texture**: a dithered, one-hue texture of the root line is allowed for the website and hero art only, never in app icons, favicons, the dock icon or UI chrome.
- **No sparkles, robots, brains or chat bubbles** in or around the mark, and no AI-art renders as brand imagery.
- Don't bake taglines or copy into brand images; text stays live HTML.

## 9. Anti-patterns

1. Purple gradient AI chrome or neon multi-accent dashboards
2. Cold pure-gray "tactical" shell as the default product theme
3. Terminal dump of tool logs without structured tool cards
4. Editor/note pane swallowing the chat column
5. Emoji as functional icons; prefer 16px stroke glyphs
6. Hover that greys out labels or lightens fg toward bg
7. Multiple solid primary CTAs in one viewport
8. Inter-only mono (use JetBrains Mono for telemetry)
9. Soft cream marketing backgrounds for agent chrome. Earth light's paper is a reading surface with soil-dark text, not a marketing wash.
10. Invented metrics or fake "AI confidence scores"
11. Rounded-pill consumer chat bubbles; keep restrained 8px cards
12. Replacing the brand mark with generic robot or sparkle logos; sparkle as the "AI" icon anywhere
13. Disabling the composer while the agent works
14. Informational text below 11px, or faint text tokens used for decoration
15. Glossy or 3D renders of the mark; text baked into images
16. A rotating 3D graph as the default way to navigate notes

## Token file

Bind `colors_and_type.css` into every new artifact. Prefer CSS variables over raw hex. Schemes: default (Earth dark), `data-theme="light"` (Earth light), `data-scheme="loam"` (optional warm dark). `data-scheme="mycelium"` and `data-scheme="ledger"` remain as aliases for older artifacts. Don't invent a fourth palette; re-run the contrast check (every text token ≥ 4.5:1 on every surface, `--border-input` ≥ 3:1) after any token change.
