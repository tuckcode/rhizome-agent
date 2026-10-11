# Fix list: Project website (tuckcode.github.io/rhizome-agent)

Source critique: [2026-10-10-design.md](./2026-10-10-design.md). When a new version comes in, change the status to `fixed` or `won't fix` instead of deleting the row.

**Open:** 3 blockers · 9 worth fixing · 7 minor

| ID | Severity | Category | Finding | Fix (tokens) | Status | First seen |
|---|---|---|---|---|---|---|
| WS-B1 | blocker | copy | Page describes Rhizome as "built around Prime Agent", "HARNESS · Prime Agent", "Tools from Hermes"; contradicts ADR-0180 | Rewrite around the Rhizome loop + vault; Prime/Hermes once as optional engines; state preview status honestly | open | 2026-10-10 |
| WS-B2 | blocker | copy | Unapproved slogan "Your work. Your memory." baked into hero.png (+ alt, aside, og:description); came from image-gen prompts | Text-free art; chosen headline as HTML; remove the slogan everywhere | open | 2026-10-10 |
| WS-B3 | blocker | visual design | Glossy 3D molecule fills the 1440×900 fold; real H1 at y≈790; baked line ~7px at 390 | HTML text hero + a product-truth figure (`hero-mock/`) | open | 2026-10-10 |
| WS-W1 | worth fixing | color | 37 elements at 3.98:1 (#70716B on #070D0A) | `--fg-tertiary` #929C86 (6.8:1); body `--fg-secondary` | open | 2026-10-10 |
| WS-W2 | worth fixing | visual design | Geist + cream #F1ECE2 on #070D0A; doesn't match the app | Import `colors_and_type.css`; Inter / JetBrains Mono; marketing scale 48/34/20/16/13 | open | 2026-10-10 |
| WS-W3 | worth fixing | hierarchy and layout | Feature grid + generic FIGs; the loop is never shown | One "How a session becomes a note" section with 4 real artifacts | open | 2026-10-10 |
| WS-W4 | worth fixing | interaction and states | Video: black first frame, no captions, no description | Poster frame, WebVTT track, 3-line text | open | 2026-10-10 |
| WS-W5 | worth fixing | copy | "DeepSeek and more" not in the provider catalog; "memory, wiki, and second brain" buzzwords | List the catalog providers; describe the folder concretely | open | 2026-10-10 |
| WS-W6 | worth fixing | hierarchy and layout | Two solid cream buttons + a third, all uppercase mono | One primary "Get started"; demo as a text link; sentence case | open | 2026-10-10 |
| WS-W7 | worth fixing | accessibility | No `<main>`, 18 region hits, Tolaria link 1.59:1 with no underline, "01Chat" heading names | `<main>`, underline inline links, fix heading names | open | 2026-10-10 |
| WS-W8 | worth fixing | hierarchy and layout | 390: section links hidden, clone URL breaks mid-word, unreadable hero | Scrollable anchor row; `pre` code block; text hero | open | 2026-10-10 |
| WS-W9 | worth fixing | copy | Fragment headings with greyed second halves | Headings that state what's shown | open | 2026-10-10 |
| WS-M1 | minor | copy | og:image / og:description carry the slogan | Regenerate from the new hero | open | 2026-10-10 |
| WS-M2 | minor | type | 9 font sizes incl. 11.5 / 12.5 | 5-step scale | open | 2026-10-10 |
| WS-M3 | minor | visual design | FIG / 1.1–4.3 numbering is decoration | Keep only captioned figures | open | 2026-10-10 |
| WS-M4 | minor | hierarchy and layout | "Prime Agent ↗" under TRUST | Move to Project / "Optional engines" | open | 2026-10-10 |
| WS-M5 | minor | interaction and states | Default 1px focus outline | 2px `--accent`, offset 2px | open | 2026-10-10 |
| WS-M6 | minor | accessibility | Slogan used as image alt | Decorative art gets an empty alt | open | 2026-10-10 |
| WS-M7 | minor | copy | Node version ranges lead the Run section | Status first; requirements in a disclosure | open | 2026-10-10 |
