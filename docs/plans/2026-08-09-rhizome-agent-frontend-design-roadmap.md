# Rhizome Agent — frontend design roadmap

Status: **draft from dogfood + v0 product lock (2026-08-09)**.  
Companion to:

- Product brief: `docs/plans/2026-08-09-rhizome-agent-v0-brief-and-roadmap.md`
- Glossary: `CONTEXT.md`
- Vision (product/engine): `docs/design/rhizome-prime-harness-vision.md`
- Session host: `docs/plans/2026-08-09-prime-harness-chat-spike.md`

**This is UI/IA sequencing for Rhizome Agent — not a Figma file and not Desktop shell wave planning.**

---

## 1. Why this doc exists

Phase 1 made Prime chat **work**. Dogfood showed the product truth:

> It feels like **Rhizome Desktop with Prime plugged into the right rail** — not yet a harness-first desktop.

That is expected (Option C bootstrap) and **not a Phase 1 failure**. It is the design debt this roadmap sequences.

Desktop-era shell specs (e.g. `docs/design/shell-final-direction.md` — network shell, command rail, graph dock, research-as-right-dock) remain useful **reference for components and tokens**. They are **not** the destination layout for Agent v0.

---

## 2. Design north star

**One line:** Chat-first harness desktop; vault is durable memory you attach and open into — not the default three-pane wiki chrome.

| Pull from | Leave behind (for Agent v0) |
|-----------|-----------------------------|
| Hermes Desktop *craft bar*: agent identity, working status, tools visible, session continuity | Hermes branding / multi-agent matrix |
| Prime: long-lived session, skills, models via `~/.prime` | Desktop multi-CLI picker as product |
| Rhizome: vault attach, open-note, promote/save, Safe/Power | Graph-first shell, full taxonomy sidebar as primary |
| Existing shadcn + dark shell tokens | Big-bang retheme |

**Success feel (v0):** “I opened Rhizome Agent to *talk to Prime* and optionally grow my vault” — not “I opened my wiki and also have a chat sidebar.”

---

## 3. Dogfood baseline (2026-08-09)

Captured in live `pnpm tauri dev` (`RhizomeAgent`):

| Observation | Design implication |
|-------------|-------------------|
| Full Desktop shell: sidebar taxonomy, note list, editor, AI right rail | Need a **chat-primary** layout track; don’t only polish the rail |
| Prime multi-turn works after IPC camelCase fix | Stream/transcript chrome can be trusted as a base |
| Onboarding briefly multi-agent; fixed to Prime-only product list | Keep all first-run copy Prime-centric |
| Composer shows **Prime ▾ · Vault Safe** | Good seeds for harness chrome; icon/status still weak |
| **No Prime mark** in picker (empty square) | Small identity fix; map missing in `AiAgentIcon` |
| Vault still dominant (Inbox, projects, note open) | Open-note stays; **primary focus** should migrate to conversation |
| Error then recovery in same thread | Error + retry UX should be first-class in transcript |

Optional later tooling (not required to execute this roadmap): Open Design / `DESIGN.md` prototypes, `computer-use` walkthroughs, `firecrawl-website-design-clone` for Hermes craft reference.

---

## 4. Information architecture (target)

### 4.1 Surfaces in v0

| Surface | Role |
|---------|------|
| **Conversation** | Primary. Transcript, streaming, tools, reasoning, errors |
| **Composer** | Prompt, Prime identity, Safe/Power, send/abort |
| **Harness status** | Working / tools running / session (lightweight) |
| **Vault attach** | Choose/open vault; degraded mode with no vault |
| **Open-note** | Secondary panel or route when a path is opened from tools/promote |
| **Settings** | Minimal: vault list, appearance; **no** multi-agent matrix; auth stays `~/.prime` |
| **First-run** | Prime install/login guidance only |

### 4.2 Surfaces deferred / hidden

| Surface | Policy |
|---------|--------|
| Graph, network shell, graph dock | Hide or do not feature; Desktop-era |
| Multi-agent picker / onboarding list | Hidden (productVisible = Prime only) |
| Full research panel as Desktop knew it | Defer; research happens *in* Prime chat + later vault tools |
| Command rail as Desktop wave destination | Not Agent v0 destination; may keep code dead |
| Dense PROJECTS/UNASSIGNED taxonomy as home | Demote once chat-primary lands |

### 4.3 Layout directions (choose in implementation, not both forever)

**A. Chat-primary (recommended for Agent)**  
Main column = conversation. Vault/note = drawer, split, or “open when needed.” Closest to Hermes Desktop / Cursor agent focus.

**B. Desktop-evolved (interim)**  
Keep three-pane; enlarge AI rail; collapse sidebar by default. Faster ship, weaker product read.

**Roadmap stance:** Ship **B only as a short interim** if needed; **A is the v0 design target** for “circle polished.” Phase 2 chrome can land on B; Phase 3–4 should not invest in making B the long-term brand.

---

## 5. Phase-aligned UI milestones

Aligns with product phases in the v0 brief. Each milestone is **demoable UX**, not only eng wiring.

### UI-0 — Baseline (done / in progress)

- [x] Prime streams in AI rail  
- [x] Prime-only product agent list (picker + onboarding)  
- [x] Chat without vault allowed for Prime  
- [x] **Prime icon** in `AiAgentIcon` + `public/ai-agent-icons/prime.svg` (placeholder mark)  
- [ ] Composer/empty states never mention Claude/Hermes/Codex as peers  

**Exit:** No missing-field errors; Prime labeled everywhere chat starts.

### UI-1 — Harness chrome (product Phase 2)

**Outcome:** Feels like an agent product, not a silent sidebar.

| Work | Notes |
|------|--------|
| Working indicator | **Started:** panel header shows working / tools / error from session status |
| Tool cards | Already partially there; tighten layout density and collapse |
| Reasoning disclosure | Keep collapsible; don’t dominate transcript |
| Skills affordance | “Skills available” / empty hint — even if list is minimal at first |
| Model display | **Started:** `PrimeHostStatus` exposes model; panel polls when Prime selected (shows after host has run get_state) |
| Session actions | New session + abort already present |
| Prime identity | **Done:** official mark in composer/onboarding; header title “Prime” |

**Exit:** User can answer “is Prime working?” and “which model?” without a terminal.

### UI-2 — Chat-primary shell (product Phase 2–3 bridge)

**Outcome:** Opening the app centers conversation.

| Work | Notes |
|------|--------|
| Default focus | Conversation focused on launch (after first-run) |
| Vault chrome demotion | Sidebar collapsed or “Vault” entry instead of full taxonomy home |
| Note-as-secondary | Open-note doesn’t steal the whole window forever |
| Window title / brand | “Rhizome Agent” not Desktop copy leftovers |
| Status bar | Strip or simplify Desktop multi-pill noise for Agent builds |

**Exit:** Screenshot no longer reads as “full Desktop + chat.”

### UI-3 — Vault-aware memory UX (product Phase 3)

**Outcome:** Memory loop is visible in the UI (pairs with issues #1–#4).

| Work | Notes |
|------|--------|
| Vault attached badge | Clear attached path / name near composer |
| Tool → open-note | Click path/result opens note surface |
| Promote / save control | Explicit button and/or obvious tool outcome card |
| Safe / Power | Toggle already seeded (“Vault Safe”); confirm copy + confirm-on-Power |
| No-vault empty | Explain memory depth locked; chat still works |
| Errors | MCP/tool failures human-readable in transcript |

**Exit:** User can promote one note and reopen it without leaving the mental model of chat.

### UI-4 — Circle polish (product Phase 4)

| Work | Notes |
|------|--------|
| First-run | Prime missing / not logged in → clear install + `prime-agent` once |
| Empty transcript | Short harness-oriented empty state (not Desktop AI onboarding essay) |
| Density / motion | Match existing tokens; no new design system required |
| Optional Open Design | Prototypes for UI-2/UI-3 if visual exploration needed |

**Exit:** Trusted-circle checklist in product brief is *feelable*, not only true in code.

---

## 6. Key flows (wireframe-level)

### F1 — First run, Prime installed

1. Optional short AI-ready card (**Prime only**)  
2. Continue → **conversation** focused  
3. Composer: Prime + Safe  

### F2 — First run, Prime missing

1. Missing Prime card: install link + “run once to log in”  
2. Chat disabled or sends blocked with same guidance  
3. No multi-agent shopping list  

### F3 — No vault

1. Chat works  
2. Badge: “No vault — memory tools locked”  
3. Attach vault CTA  

### F4 — Vault attached turn

1. User prompts  
2. Status: working → tool cards (search/read)  
3. Result path → open-note  
4. Optional promote/save  

### F5 — Promote

1. Explicit control or tool completion card “Saved to vault”  
2. Open note action  
3. Never silent dual-write of whole thread  

### F6 — Error recovery

1. Inline error in transcript (as today)  
2. Retry / edit resend without losing thread  
3. No stuck “thinking” without abort  

---

## 7. Visual / component notes

- **Tokens:** Keep shipped CSS variables / shadcn; Agent is not a retheme project.  
- **Prime mark:** Add asset + `AiAgentIcon` map entry; avoid empty square in composer.  
- **Copy:** “Ask Prime Agent” is good; retire “local AI agents” plural in Agent builds.  
- **Density:** Prefer harness density (transcript + tools) over note-list density in the primary column.  
- **Desktop `.pen` files** under `design/`: historical; don’t treat as Agent source of truth.

---

## 8. Explicit non-goals (frontend)

- Implementing Desktop **network shell** / graph dock as Agent destination  
- Multi-agent onboarding or settings matrix  
- Full visual redesign / new theme pack for v0  
- Open Design / Figma as a gate before eng  
- Perfect Hermes parity chrome in v0 (skills+status is enough; “D eventually” stays later)  
- Blocking Phase 3 MCP eng on UI-2 completion — MCP can land while shell still interim  

---

## 9. Relationship to eng tickets

| Product / eng | Frontend milestone |
|---------------|--------------------|
| Phase 1 chat path | UI-0 |
| Phase 2 harness depth | UI-1 (+ start UI-2) |
| Phase 3 #1–#4 memory | UI-3 (and open-note/promote) |
| Phase 4 circle | UI-4 |
| Phase 5 later parity | Beyond this doc |

Prune policy (product brief): hide competing agent chrome early; keep vault chrome needed for open-note until UI-3.

---

## 10. Open design questions (small)

Resolve in implementation or a short follow-up — not another full product grill:

1. **Interim B vs jump to A:** How long do we keep three-pane as default after UI-1?  
2. **Open-note presentation:** Side split vs overlay vs temporary main swap?  
3. **Promote control:** Composer button vs transcript action vs tool-only?  
4. **Status bar:** Strip in Agent builds or keep minimal vault/git pills?  
5. **Pop-out AiWorkspace:** Keep as power feature or demote until chat-primary lands?  

---

## 11. Suggested next actions

1. **UI-0 leftover:** Prime icon asset + map (small PR).  
2. **UI-1:** Working status + model display on current rail (can ship on interim layout).  
3. **Parallel eng:** Issue #1 MCP (does not wait on UI-2).  
4. **UI-2 spike:** One vertical slice that defaults focus to conversation (feature-flag if needed).  
5. **Optional:** Open Design project + `DESIGN.md` only if UI-2/UI-3 need visual exploration beyond markdown.

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-08-09 | Initial frontend design roadmap from dogfood + v0 brief lock. |
