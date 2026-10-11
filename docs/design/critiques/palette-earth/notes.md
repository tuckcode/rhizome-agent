# Rhizome Earth palette: token changes (2026-10-10)

This proposal is for the rebrand from "Rhizome Agent" to "Rhizome". `earth-tokens.css` is a drop-in replacement for `colors_and_type.css`: the token names, selectors and non-colour tokens are unchanged.

**Comparison:** `compare.png` (1600×1000), rendered from `index.html`.

**How the ratios work:**
- "vs bg" is the WCAG contrast ratio against `--bg`.
- "min" is the worst ratio across all 13 surface tokens: bg, surface, surface-2, surface-3, sidebar, popover, input, dialog, titlebar-top, tool-bg, user-bg, state-selected and state-hover.
- Semantic text is also checked on its own tint (e.g. `--warn` on `--warn-bg`) composited over bg, surface and surface-2.
- Every text token passes 4.5:1 in both Earth themes. `pal.py` re-runs the check.

## Dark: Mycelium → Earth dark

| Token | Old | New | Old vs bg / min | New vs bg / min |
|---|---|---|---|---|
| `--bg` | `#0E120C` | `#0F110C` |  |  |
| `--surface` | `#151A12` | `#16170F` |  |  |
| `--fg` | `#E6EBE0` | `#E9E8DC` | 15.60 / 11.86 | 15.41 / 12.76 |
| `--muted` | `#79836F` | `#999784` | 4.76 / 3.62 | 6.43 / 5.33 |
| `--border` | `#232A1F` | `#2A281D` | 1.28 (non-text) | 1.28 (non-text) |
| `--surface-2` | `#1B2117` | `#1C1D14` |  |  |
| `--surface-3` | `#222A1C` | `#23231A` |  |  |
| `--surface-sidebar` | `#10150E` | `#121410` |  |  |
| `--surface-popover` | `#1B2117` | `#1C1D14` |  |  |
| `--surface-input` | `#0E120C` | `#0F110C` |  |  |
| `--surface-dialog` | `#181E14` | `#19190F` |  |  |
| `--page-wash` | `#080A07` | `#090A07` |  |  |
| `--titlebar-top` | `#181E14` | `#19190F` |  |  |
| `--fg-heading` | `#F2F6ED` | `#F4F2E8` | 17.27 / 13.13 | 16.92 / 14.01 |
| `--fg-secondary` | `#ADB6A3` | `#BDBAA8` | 9.00 / 6.84 | 9.72 / 8.05 |
| `--fg-tertiary` | `#929C86` | `#A8A592` | 6.59 / 5.01 | 7.65 / 6.34 |
| `--muted-2` | `#5C6553` | `#8F8D7B` | 3.10 / 2.36 | 5.66 / 4.69 |
| `--accent-ink` | `#0E120C` | `#0F110C` |  |  |
| `--border-subtle` | `#1A2016` | `#1F1E16` | 1.14 (non-text) | 1.14 (non-text) |
| `--border-strong` | `#333D2B` | `#3B3828` | 1.66 (non-text) | 1.61 (non-text) |
| `--ok-bg` | `rgba(155, 207, 126, 0.16)` | `rgba(155, 207, 126, 0.14)` |  |  |
| `--warn` | `#E0A458` | `#E9B04F` | 8.66 / 6.59 | 9.76 / 8.08 |
| `--warn-bg` | `rgba(224, 164, 88, 0.14)` | `rgba(233, 176, 79, 0.13)` |  |  |
| `--danger` | `#E8837C` | `#EE8B7E` | 7.18 / 5.46 | 7.80 / 6.46 |
| `--danger-bg` | `rgba(232, 131, 124, 0.12)` | `rgba(238, 139, 126, 0.12)` |  |  |
| `--state-hover` | `#1B2117` | `#1C1D14` |  |  |
| `--state-selected` | `#1B2E22` | `#1A2619` |  |  |
| `--state-active` | `#1E3326` | `#1C291B` |  |  |
| `--state-disabled` | `#161B12` | `#15160F` |  |  |
| `--user-bg` | `#1B2E22` | `#1A2619` |  |  |
| `--tool-bg` | `#10150E` | `#121410` |  |  |
| `--shadow` | `rgba(0, 0, 0, 0.45)` | `rgba(0, 0, 0, 0.5)` |  |  |
| `--shadow-dialog` | `rgba(0, 0, 0, 0.55)` | `rgba(0, 0, 0, 0.58)` |  |  |
| `--shadow-window` | `0 28px 70px rgba(0, 0, 0, 0.45)` | `0 28px 70px rgba(0, 0, 0, 0.5)` |  |  |

Unchanged: `--accent`, `--border-focus`, `--accent-dim`, `--accent-hot`, `--accent-bg`, `--ok`, `--info`, `--font-display`, `--font-body`, `--font-mono`, `--font-size-xs`, `--font-size-sm`, `--font-size-md`, `--font-size-base`, `--font-size-lg`, `--font-size-xl`, `--font-size-2xl`, `--font-size-3xl`, `--line-height-tight`, `--line-height-body`, `--line-height-prose`, `--letter-tight`, `--letter-mono`, `--letter-kicker`, `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`, `--space-7`, `--space-8`, `--space-10`, `--space-12`, `--gap-rail`, `--gap-msg`, `--pad-transcript-x`, `--pad-transcript-y`, `--rail-w`, `--session-w`, `--frame-w`, `--frame-h`, `--titlebar-h`, `--subhead-h`, `--chip-h`, `--btn-h`, `--icon-btn`, `--touch-min`, `--radius`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill`, `--r`, `--r-sm`, `--t`, `--t-scheme`, `--t-pulse`

## Light: Ledger → Earth light

| Token | Old | New | Old vs bg / min | New vs bg / min |
|---|---|---|---|---|
| `--bg` | `#EFF1EC` | `#F1ECE2` |  |  |
| `--surface` | `#F7F8F5` | `#F8F5EE` |  |  |
| `--fg` | `#23281F` | `#2A251E` | 13.24 / 12.01 | 12.91 / 11.57 |
| `--muted` | `#77806E` | `#625A4D` | 3.62 / 3.29 | 5.77 / 5.18 |
| `--border` | `#D6DBCF` | `#DDD4C3` | 1.24 (non-text) | 1.25 (non-text) |
| `--accent` | `#2E6B4F` | `#2C6A4D` | 5.54 / 5.03 | 5.44 / 4.88 |
| `--surface-2` | `#FBFCFA` | `#FCFAF6` |  |  |
| `--surface-3` | `#E3E7DE` | `#E7E0D2` |  |  |
| `--surface-sidebar` | `#E9ECE5` | `#ECE6DA` |  |  |
| `--surface-popover` | `#FBFCFA` | `#FCFAF6` |  |  |
| `--surface-input` | `#FBFCFA` | `#FCFAF6` |  |  |
| `--surface-dialog` | `#F9FAF7` | `#FAF7F1` |  |  |
| `--page-wash` | `#E3E7DE` | `#E7E0D2` |  |  |
| `--titlebar-top` | `#F9FAF7` | `#FAF7F1` |  |  |
| `--fg-heading` | `#1B2017` | `#1E1A15` | 14.59 / 13.24 | 14.69 / 13.17 |
| `--fg-secondary` | `#4C5546` | `#4E473C` | 6.85 / 6.22 | 7.79 / 6.98 |
| `--fg-tertiary` | `#616A59` | `#575043` | 4.97 / 4.51 | 6.77 / 6.07 |
| `--muted-2` | `#97A08D` | `#6B6354` | 2.39 / 2.17 | 5.04 / 4.52 |
| `--accent-ink` | `#F7F8F5` | `#F8F5EE` |  |  |
| `--border-subtle` | `#E1E5DA` | `#E6DFD1` | 1.12 (non-text) | 1.13 (non-text) |
| `--border-strong` | `#C2C9B8` | `#C8BDA8` | 1.50 (non-text) | 1.58 (non-text) |
| `--border-focus` | `#2E6B4F` | `#2C6A4D` |  |  |
| `--accent-dim` | `rgba(46, 107, 79, 0.12)` | `rgba(44, 106, 77, 0.11)` |  |  |
| `--accent-hot` | `#245741` | `#22573F` |  |  |
| `--accent-bg` | `rgba(46, 107, 79, 0.12)` | `rgba(44, 106, 77, 0.11)` |  |  |
| `--ok` | `#38A169` | `#3D6A1E` | 2.85 / 2.59 | 5.44 / 4.88 |
| `--ok-bg` | `rgba(56, 161, 105, 0.1)` | `rgba(61, 106, 30, 0.10)` |  |  |
| `--warn` | `#B4552D` | `#8A5208` | 4.32 / 3.92 | 5.42 / 4.86 |
| `--warn-bg` | `#F2E8CE` | `#F3E4C4` |  |  |
| `--danger` | `#C03D30` | `#A3342A` | 4.67 / 4.24 | 5.79 / 5.19 |
| `--danger-bg` | `rgba(192, 61, 48, 0.1)` | `rgba(163, 52, 42, 0.09)` |  |  |
| `--info` | `#2E6B4F` | `#2C6A4D` |  |  |
| `--state-hover` | `#E5E9DF` | `#EAE3D6` |  |  |
| `--state-selected` | `#DFE9E2` | `#E1E6DA` |  |  |
| `--state-active` | `#DFE9E2` | `#DCE3D5` |  |  |
| `--state-disabled` | `#EBEEE6` | `#EEE9DF` |  |  |
| `--user-bg` | `#DFE9E2` | `#E1E6DA` |  |  |
| `--tool-bg` | `#E9ECE5` | `#EFEADF` |  |  |
| `--shadow` | `rgba(26, 30, 22, 0.18)` | `rgba(42, 34, 22, 0.16)` |  |  |
| `--shadow-dialog` | `rgba(26, 30, 22, 0.15)` | `rgba(42, 34, 22, 0.14)` |  |  |
| `--shadow-window` | `0 28px 70px rgba(26, 30, 22, 0.18)` | `0 28px 70px rgba(42, 34, 22, 0.16)` |  |  |

Unchanged: 

## Trade-offs

- **The muted text ladder is compressed.** To make `--muted` and `--muted-2` pass AA on every surface, the steps between them get small:
  - Dark: tertiary 7.65, muted 6.43, muted-2 5.66 (vs bg).
  - Light: tertiary 6.77, muted 5.77, muted-2 5.04 (vs bg).
  The two muted tokens are now barely different, so hierarchy has to come from size, weight and position, not grey level. `--muted-2` can no longer serve as a faint decorative grey. I'd add a non-text token for dividers, rail hints and the like (e.g. `--decor`: old `#5C6553` dark / `#C8BDA8` light). I didn't add it here so the file stays drop-in compatible.
- **Light warn is amber-brown, not bright amber.** A bright amber on paper can't pass 4.5:1 as text (`#C98A1E` is 2.5:1), so `--warn` is `#8A5208`. The amber shows up in the `--warn-bg` fill (`#F3E4C4`). Dark warn is a real amber, `#E9B04F` (9.76:1).
- **Light ok moved to leaf green.** At AA strength, the old `#38A169` would sit almost on top of the forest accent. It's now `#3D6A1E`, a yellower green that stays distinct from `--accent` `#2C6A4D`. Dark ok is unchanged.
- **The dark user bubble is darker.** `--user-bg` and `--state-selected` are `#1A2619` (was `#1B2E22`), so muted text still passes on them. User bubbles stand out slightly less; the border carries the shape.
- **The earth tint in dark is deliberately subtle.** It shows mostly in borders, sidebar, chips and the warmer text greys. Fully brown surfaces read as muddy next to the mint, so the base stays green-black (`#0F110C`). For more warmth, push `--surface` and `--surface-2` about 2 steps toward `#1A170F`. Every text token still passes there.
- **Borders are still faint (unchanged issue).** `--border` is about 1.25–1.28:1 and `--border-strong` about 1.6:1 against bg, same as today. Controls that depend on their border (inputs, unselected chips) still need a 3:1 non-text boundary (WCAG 1.4.11): use a focus or hover fill, or a dedicated input border: `#75705C` dark (3.82:1 on bg, 3.19 on surface-3); now shipped as `--border-input` / `#857B66` light (3.55:1 on bg, 3.18 on surface-3).
- **Mint is unchanged** (`#6FE3A0` dark), so the identity carries over. Against warmer neutrals it looks slightly brighter.

## Warm dark: Earth dark, warm ("loam")

The selector is `[data-scheme="loam"], [data-theme="dark-warm"]` in `earth-tokens.css`, and it uses the same token names. It pushes surfaces, borders and sidebar toward loam brown (hue about 35°, low saturation) while keeping the mint `#6FE3A0`. Comparison: `compare-dark-warm.png`, rendered from `index-dark-warm.html`.

All text tokens pass 4.5:1 against all 13 surfaces. Chip text on its tinted fill passes over bg, surface and surface-2: ok 7.22–8.46, warn 6.70–7.93, danger 5.77–6.78, accent 7.52–8.89.

| Token | Mycelium (current) | Earth dark (subtle) | Loam (warm) | Loam vs bg / min |
|---|---|---|---|---|
| `--bg` | `#0E120C` | `#0F110C` | `#15110C` |  |
| `--surface` | `#151A12` | `#16170F` | `#1D1811` |  |
| `--fg` | `#E6EBE0` | `#E9E8DC` | `#EDE6D8` | 15.13 / 12.35 |
| `--muted` | `#79836F` | `#999784` | `#A3987F` | 6.58 / 5.37 |
| `--border` | `#232A1F` | `#2A281D` | `#352C20` | 1.37 (non-text) |
| `--surface-2` | `#1B2117` | `#1C1D14` | `#241E15` |  |
| `--surface-3` | `#222A1C` | `#23231A` | `#2B2419` |  |
| `--surface-sidebar` | `#10150E` | `#121410` | `#19150F` |  |
| `--surface-popover` | `#1B2117` | `#1C1D14` | `#241E15` |  |
| `--surface-input` | `#0E120C` | `#0F110C` | `#15110C` |  |
| `--surface-dialog` | `#181E14` | `#19190F` | `#211B13` |  |
| `--page-wash` | `#080A07` | `#090A07` | `#0C0A07` |  |
| `--titlebar-top` | `#181E14` | `#19190F` | `#211B13` |  |
| `--fg-heading` | `#F2F6ED` | `#F4F2E8` | `#F7F1E5` | 16.71 / 13.64 |
| `--fg-secondary` | `#ADB6A3` | `#BDBAA8` | `#C6BBA6` | 9.90 / 8.08 |
| `--fg-tertiary` | `#929C86` | `#A8A592` | `#B2A791` | 7.90 / 6.45 |
| `--muted-2` | `#5C6553` | `#8F8D7B` | `#9A8F78` | 5.88 / 4.80 |
| `--accent-ink` | `#0E120C` | `#0F110C` | `#15110C` |  |
| `--border-subtle` | `#1A2016` | `#1F1E16` | `#272017` | 1.17 (non-text) |
| `--border-strong` | `#333D2B` | `#3B3828` | `#4A3D2C` | 1.79 (non-text) |
| `--border-input` | `—` | `#75705C` | `#7E6F59` | bg 3.85 · surface 3.61 · surface-2 3.39 · surface-3 3.14 |
| `--ok` | `#9BCF7E` | `#9BCF7E` | `#A6D282` | 10.88 / 8.88 |
| `--ok-bg` | `rgba(155, 207, 126, 0.16)` | `rgba(155, 207, 126, 0.14)` | `rgba(166, 210, 130, 0.13)` |  |
| `--warn` | `#E0A458` | `#E9B04F` | `#EDB451` | 10.07 / 8.22 |
| `--warn-bg` | `rgba(224, 164, 88, 0.14)` | `rgba(233, 176, 79, 0.13)` | `rgba(237, 180, 81, 0.13)` |  |
| `--danger` | `#E8837C` | `#EE8B7E` | `#F2917F` | 8.17 / 6.67 |
| `--danger-bg` | `rgba(232, 131, 124, 0.12)` | `rgba(238, 139, 126, 0.12)` | `rgba(242, 145, 127, 0.12)` |  |
| `--state-hover` | `#1B2117` | `#1C1D14` | `#241E15` |  |
| `--state-selected` | `#1B2E22` | `#1A2619` | `#1F2719` |  |
| `--state-active` | `#1E3326` | `#1C291B` | `#212A1A` |  |
| `--state-disabled` | `#161B12` | `#15160F` | `#1A1610` |  |
| `--user-bg` | `#1B2E22` | `#1A2619` | `#1F2719` |  |
| `--tool-bg` | `#10150E` | `#121410` | `#19150F` |  |
| `--shadow` | `rgba(0, 0, 0, 0.45)` | `rgba(0, 0, 0, 0.5)` | `rgba(0, 0, 0, 0.5)` |  |
| `--shadow-dialog` | `rgba(0, 0, 0, 0.55)` | `rgba(0, 0, 0, 0.58)` | `rgba(0, 0, 0, 0.58)` |  |
| `--shadow-window` | `0 28px 70px rgba(0, 0, 0, 0.45)` | `0 28px 70px rgba(0, 0, 0, 0.5)` | `0 28px 70px rgba(0, 0, 0, 0.5)` |  |

## New token: `--border-input` (all three Earth schemes)

This is additive: no existing token is renamed. It gives inputs, unselected chips and other controls that are identified by their outline a ≥3:1 boundary (WCAG 1.4.11). Fallback: `var(--border-input, var(--border-strong))`.

| Scheme | Value | Ratio vs bg · surface · surface-2 · surface-3 |
|---|---|---|
| Earth dark | `#75705C` | bg 3.82 · surface 3.63 · surface-2 3.42 · surface-3 3.19 |
| Loam | `#7E6F59` | bg 3.85 · surface 3.61 · surface-2 3.39 · surface-3 3.14 |
| Earth light | `#857B66` | bg 3.55 · surface 3.84 · surface-2 4.01 · surface-3 3.18 |

### Loam trade-offs
- **Mint pops harder.** On brown, the mint is now the complementary-ish colour, so the one-accent rule matters even more. Keep mint to the primary button, the running state and the selected node.
- **Selection and user bubble go olive.** `--state-selected` and `--user-bg` are `#1F2719`, a green-olive tint on brown, so "selected = mint family" still reads. A pure brown selection would blend into `--surface-2`.
- **Warn and the background are close in hue.** Amber warn sits near the brown ground (its ratio is fine at 10.07). Chips rely on the tinted fill and the ⚠ glyph, not hue alone.
- **Borders are a little more visible** (`--border` 1.37 vs 1.28 against bg), which helps panels separate. `--border-strong` is `#4A3D2C`.
- **Not orange or muddy.** Surfaces stay at low chroma (S ≈ 25–30%, L 6–16%). Pushing past `#2B2419` for `--surface-3` starts to read as leather or orange, so I'd stop here.
