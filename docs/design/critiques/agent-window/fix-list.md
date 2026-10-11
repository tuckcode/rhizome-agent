# Fix list: Rhizome Agent window (`rhizome-agent-desktop-ui.html`)

Source critiques: [2026-10-10-a11y.md](./2026-10-10-a11y.md) (B/W/M IDs) and [2026-10-10-design.md](./2026-10-10-design.md) (D- IDs). When a new version comes in, change the status to `fixed` or `won't fix` instead of deleting the row.

**Open:** 7 blockers · 23 worth fixing · 26 minor (a11y 5/11/13 + design 2/12/13)

| ID | Severity | Category | Finding | Fix (tokens) | Status | First seen |
|---|---|---|---|---|---|---|
| B1 | blocker | names and roles | Streaming, tool start/finish, completion and stop aren't announced: no `role=log`/`status`/`aria-live` in the window | Transcript `role="log" aria-live="polite"`; one empty `role="status"` for throttled run updates; `aria-busy` on the streaming message | open | 2026-10-10 |
| B2 | blocker | contrast | Ledger `--muted` #77806E is 3.45–4.00:1 on every surface (subhead, meta, chips, tool paths, ghost buttons, empty state) | Ledger `--muted` → `--fg-tertiary` #616A59 (4.74–5.49); `--fg-secondary` on danger tint | open | 2026-10-10 |
| B3 | blocker | contrast | `--muted-2` used for text: composer footer 2.90 / 2.28, subhead kbd 2.90 / 2.55, placeholder 3.10 / 2.39 | Footer and kbd → `--fg-tertiary`; placeholder → `--muted` (dark) / `--fg-tertiary` (Ledger); DESIGN.md: `--muted-2` decoration only | open | 2026-10-10 |
| B4 | blocker | contrast | Ledger status text: `--ok` "DONE" 2.72, toast OK 3.15, `--danger` Stop 3.88 and locked 4.45, `--warn` 4.32 | Add `--ok-text` #276E45, `--danger-text` #A3352A, `--warn-text` #9A4524 for text | open | 2026-10-10 |
| B5 | blocker | keyboard and focus | Model chip "xai / grok-4.5 ▾" is a span: not focusable or operable | `<button aria-haspopup="listbox" aria-expanded aria-label="Model: …">` + 2px `--accent` focus ring; same for other chips that open something | open | 2026-10-10 |
| W1 | worth fixing | keyboard and focus | Busy state `disabled`s the textarea, so focus drops to body and the next message can't be drafted | Keep the textarea enabled and focused (or `readonly` + `aria-disabled`); update DESIGN.md §6 | open | 2026-10-10 |
| W2 | worth fixing | keyboard and focus | Textarea focus uses `outline:none` + 1px shadow, which isn't the spec ring and vanishes in forced colors | `:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px }` | open | 2026-10-10 |
| W3 | worth fixing | keyboard and focus | `[[memory-loop]]` wiki link is a span: not focusable; underline 1.66 / 1.50 | `<a>` or `<button>`; underline `--muted` (dark) / `--fg-tertiary` (Ledger) | open | 2026-10-10 |
| W4 | worth fixing | contrast | Mycelium `--muted` is 4.45 on `--surface`, 4.14 on `--surface-2`, 4.05 on danger tint (sessions, note bar, onboarding, Retry) | Use `--fg-tertiary` #929C86 on surface and above (5.59–6.16), or `--muted` → #828C78 | open | 2026-10-10 |
| W5 | worth fixing | contrast | Textarea border 1.66 / 1.50 vs `--bg` (1.4.11) | New `--border-input` at 3:1 or more (e.g. `--muted`: 4.76 / 3.62) | open | 2026-10-10 |
| W6 | worth fixing | contrast | Selected session row: `--bg` fill + `--border-strong` 1.55, not perceivable | `background: var(--state-selected); border-color: var(--accent)` (11.08 / 5.91) or `--fg-tertiary` border | open | 2026-10-10 |
| W7 | worth fixing | names and roles | Session list: no `aria-current`, `div` inside `button`, not a list | `ul > li > button[aria-current="true"]`, spans inside | open | 2026-10-10 |
| W8 | worth fixing | structure | No `<main>`; transcript, composer and panes outside or unnamed landmarks (axe landmark-one-main, region) | `<main aria-label="Chat">`, composer `<form aria-label="Message Prime">`, named asides | open | 2026-10-10 |
| W9 | worth fixing | structure | Transcript messages are bare divs with no headings, so there's no message-to-message navigation | `<article>` per message with hidden `h2` "You, 14:02"; tool stack `<ol aria-label="Tool calls">` | open | 2026-10-10 |
| W10 | worth fixing | text size | Text at 8–10.5px across meta, status, footer, kbd, subhead, session meta, tag; DESIGN.md sets 10px kickers | 11px (`--font-size-sm`) floor for text that carries information; revise `--font-size-xs` / DESIGN.md §3 | open | 2026-10-10 |
| W11 | worth fixing | motion | First-run ASCII loops every 700ms forever (2.2.2); caret and pulses loop for the whole run | Play ASCII once then hold; stop caret blink after 5s; one pulse max | open | 2026-10-10 |
| M1 | minor | names and roles | Titlebar chips "Laputa" and "get_note" rely on `title` for meaning | Visually hidden "Vault:" / "Last tool:" prefix | open | 2026-10-10 |
| M2 | minor | keyboard and focus | Icon tooltips are hover-only `title`; Close note has none | Custom tooltip on `:hover` and `:focus-visible`, Esc-dismissable | open | 2026-10-10 |
| M3 | minor | names and roles | ⌘ ↵ ▸ ▾ glyphs read literally | `aria-label`s on kbd hints; `content: "▸" / ""`; `aria-hidden` SVG chevrons | open | 2026-10-10 |
| M4 | minor | names and roles | Toast `role=status` and inline `role=alert` rendered with content already in them; alert misused for an expected state | Mount empty regions at start; `status` for locked notice | open | 2026-10-10 |
| M5 | minor | contrast | "CHAT" rail hint 8px at 2.06 / 1.86 | Remove, or 11px `--fg-tertiary`, no opacity | open | 2026-10-10 |
| M6 | minor | contrast | Stop border 2.89 / 2.36, ghost borders 1.28, idle marker borders 1.66 / 1.50, Ledger ok dot 2.85 | Full `--danger` border on Stop; `--border-strong` on ghost buttons | open | 2026-10-10 |
| M7 | minor | color-only meaning | Ledger done and pending markers differ only by two greens (1.94:1 apart) | Shape per state: check / hollow / × | open | 2026-10-10 |
| M8 | minor | motion | Under reduced motion the static spinner is a full ring that reads as "done" | Keep a ¾ arc or "…" | open | 2026-10-10 |
| M9 | minor | contrast | Ledger "Prime" accent chip at 4.50 worst case; annotation labels 3.94 | `--accent-hot` #245741 for chip text (5.99) | open | 2026-10-10 |
| M10 | minor | keyboard and focus | Harness scheme switcher: fake tablist, 6 tab stops, buttons wear their own theme (2.54–3.86) | `radiogroup` or `aria-pressed`; scope tokens to `html[data-scheme]` | open | 2026-10-10 |
| M11 | minor | structure | Second `h1`s in note pane and first-run; note `h2`s styled as 11px kickers; axe heading-order | Note title `h2`, sections `h3`; style with classes | open | 2026-10-10 |
| M12 | minor | keyboard and focus | Esc doubles as Stop and will collide with closing popovers | Esc closes the topmost transient first; ⌘. always stops | open | 2026-10-10 |
| M13 | minor | text size | At 200% zoom the "Running tools · 2" chip is clipped and get_note and shortcut hints are hidden | Status chip `flex-shrink: 0`; vault chip truncates first | open | 2026-10-10 |
| D-B1 | blocker | interaction and states | Frame F: selected session shows the new-chat empty state | Selected session renders its transcript; empty state only for a new chat | open | 2026-10-10 |
| D-B2 | blocker | copy | Frame C: toast title ≠ created note; Save to vault still active after saving | Toast echoes the real title and folder + Open; button → disabled "Saved" in `--ok` | open | 2026-10-10 |
| D-W1 | worth fixing | color | Mint accent hits: A 13, B–D 6, E 5+glow (max 2) | Mint only for rail current + one primary/status; the rest → `--fg-tertiary` / `--muted` / default chip | open | 2026-10-10 |
| D-W2 | worth fixing | color | Frame D: two solid primary buttons | Empty-state Attach vault → `.btn-save`; remove titlebar copy | open | 2026-10-10 |
| D-W3 | worth fixing | hierarchy and layout | Frame D: "no vault" stated 7 times | Once in the empty state + once in the composer chip | open | 2026-10-10 |
| D-W4 | worth fixing | interaction and states | Frame D: expected locked state styled as an error, with a dead-end Retry | `--warn` "needs vault", inline note with Attach vault, no Retry | open | 2026-10-10 |
| D-W5 | worth fixing | hierarchy and layout | Frame B: 50/50 split (rule: conversation ≥ 55%) | `minmax(0,3fr) minmax(320px,2fr)` + divider that stops at 55% | open | 2026-10-10 |
| D-W6 | worth fixing | hierarchy and layout | Vault ×3, last tool ×3, model ×2, conflicting stop shortcuts | Titlebar status / subhead telemetry / composer controls only / one hint | open | 2026-10-10 |
| D-W7 | worth fixing | interaction and states | Frame A: "Running tools · 2" with 1 pending; Open enabled while pending | Count the pending tools; disable Open until done | open | 2026-10-10 |
| D-W8 | worth fixing | copy | Designer notes in UI copy; promote vs save mixed | Remove annotations; one verb, recorded in DESIGN.md §8 | open | 2026-10-10 |
| D-W9 | worth fixing | interaction and states | Frame D: empty state stays above the conversation | Show only while the transcript is empty | open | 2026-10-10 |
| D-W10 | worth fixing | interaction and states | Frame E: blank ASCII on direct load, raw "—" placeholders, no recheck state, error red for a first run | Fix init order; "Not connected yet"; Checking… state; neutral/`--warn` chip | open | 2026-10-10 |
| D-W11 | worth fixing | spacing | Spacing off the 4px scale (5/6/7/9/10/11/13/14/18/22px) | Snap to `--space-*`; update DESIGN.md §4 | open | 2026-10-10 |
| D-W12 | worth fixing | type | 15 font sizes; 13.5px body; weight 510 | Map to the token scale; 500 weight | open | 2026-10-10 |
| D-M1 | minor | interaction and states | Toast far from its message; "OK" label | Anchor near the actions; check icon + Open/Undo | open | 2026-10-10 |
| D-M2 | minor | hierarchy and layout | Message actions start with Regenerate | Copy · Save to vault · Fork · ⋯ Regenerate | open | 2026-10-10 |
| D-M3 | minor | interaction and states | Tool card Open style differs between frames | One style: `.btn-sm` default | open | 2026-10-10 |
| D-M4 | minor | hierarchy and layout | Two New chat buttons in F | One, in the session header | open | 2026-10-10 |
| D-M5 | minor | copy | Session meta mixes time and status; no grouping or row menu | "14:08 · working", Today/Earlier, ⋯ menu | open | 2026-10-10 |
| D-M6 | minor | hierarchy and layout | Session id moves to the titlebar in F (inline 10px) | Subhead only | open | 2026-10-10 |
| D-M7 | minor | spacing | Controls use a 6px radius vs DS 8px | Pick one and update the DS | open | 2026-10-10 |
| D-M8 | minor | type | Text glyph chevrons; vertical CHAT hint | Stroke SVG chevron; remove the hint | open | 2026-10-10 |
| D-M9 | minor | copy | Tool cards have no outcome | Result count + duration in `--muted` | open | 2026-10-10 |
| D-M10 | minor | type | Fonts from the CDN; JetBrains Mono 500 not bundled | Bundle locally; use 600 | open | 2026-10-10 |
| D-M11 | minor | interaction and states | Resizable textarea with a grip | Auto-grow, `resize: none` | open | 2026-10-10 |
| D-M12 | minor | copy | First-run button copy | "Install Prime ↗", "Check again" | open | 2026-10-10 |
| D-M13 | minor | hierarchy and layout | Harness annotations can't be hidden | Annotations toggle | open | 2026-10-10 |
