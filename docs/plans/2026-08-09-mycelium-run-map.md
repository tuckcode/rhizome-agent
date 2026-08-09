# Mycelium — agent run map (rail, with Graph)

**Status:** Named product track (2026-08-09). Not started as eng milestone.  
**Codename / rail:** Mycelium  
**Sibling lenses:** Graph (wiki topology) · **Mycelium** (agent attention) · Changes (git)

## Intent

Show **where a Prime run put attention** on a repository — search / read / edit footprint — so thrash and scope are visible at a glance. Saves human debugging time; a text digest of the same footprint can later save agent tokens.

Not a second memory product. Does **not** replace promote/save to vault.

## Why Mindwalk, not a greenfield citymap

- [Mindwalk](https://github.com/cosmtrek/mindwalk) (MIT): local replay of coding-agent sessions on a deterministic repo “citymap.”
- **Prime is built on Pi.** Session files in `~/.prime/agent/sessions/*.jsonl` already parse in Mindwalk as `harness: pi`.
- Gap: Prime’s dominant tool is **`ipython`** (often `%%bash` cells). Raw sessions → all `other`, **0 file targets**. Bridge: map `ipython`+`%%bash` → `bash`/`command` (validated spike: 200+ targeted events on a real session).

## Product placement

Command rail, **with the node map (Graph)**:

```text
Notes · Graph · Mycelium · Research · Changes · Settings
```

- Own full main-pane destination (like Graph), not a toggle inside AI chat.
- Empty states: Mindwalk missing (BYO install), no tool-using session, vault-only cwd (weak city — explain).

## Phases

### M0 — Spike (done informally 2026-08-09)

- [x] Confirm Prime JSONL parses as pi in Mindwalk
- [x] Confirm raw map is dark (ipython)
- [x] Confirm bashify bridge lights paths

### M1 — Bridge + open (eng)

- [ ] `prime-session-to-mindwalk` normalizer (script or small Rust/TS module)
- [ ] Detect `mindwalk` on PATH
- [ ] One-click or CLI: bridge current/last Prime session → `mindwalk open <file>`
- [ ] Optional: contribute upstream Mindwalk `ipython` handling so bridge thins over time

### M2 — Rail destination

- [ ] `CommandRailDestination` += `mycelium`
- [ ] Main pane shell + empty states + open external or embed `127.0.0.1` WebView
- [ ] l10n: `rail.mycelium`, short description
- [ ] PostHog: `rail_destination_clicked` already covers rail; optional `mycelium_opened`

### M3 — Native feel

- [ ] Bind to **this chat’s** Prime session id when known
- [ ] Session picker over `~/.prime/agent/sessions/`
- [ ] Prefer repo cwd; warn when cwd is vault-only
- [ ] Optional: footprint digest → promote note / next-turn context

### M4 — Fork / rebrand (only if needed)

- [ ] Vendor or ship Mycelium-branded binary if BYO is too rough
- [ ] Theme tokens to Rhizome; keep adapter/citymap core
- [ ] License: Mindwalk MIT; Agent remains AGPL — prefer separate process over silent embed without clear boundary

## Non-goals (v0)

- Replacing Graph or Changes
- Full in-app Three.js rewrite “inspired by” Mindwalk without their engine
- Blocking Phase 3 promote/save or vault tools on Mycelium
- Safe/Power mode for Mycelium

## Decision log

| Date | Decision |
|------|----------|
| 2026-08-09 | Name **Mycelium**; rail **with Graph** |
| 2026-08-09 | v1 = BYO Mindwalk + Prime bridge, not embed-first |
| 2026-08-09 | Prime-on-Pi is the format reason Mindwalk almost works already |
