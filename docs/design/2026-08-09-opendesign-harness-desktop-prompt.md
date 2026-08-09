# Open Design prompt — Rhizome Agent harness desktop (UI mockup)

**Use this entire document as the Open Design / design-tool brief.**  
Product: **Rhizome Agent** (not Rhizome Desktop wiki). Engine: **Prime Agent** only.  
Goal: high-fidelity **desktop UI mockups** of a chat-first AI agent harness with vault memory — every vital component visible.

---

## 0. One-sentence ask

Design a **native macOS-feeling desktop app** that looks like someone opened it to **talk to a long-running AI agent (Prime)**, with optional **vault memory** (search / open notes / explicit save), not like a three-pane Obsidian clone with a chat sidebar bolted on.

---

## 1. Product identity (do not invent a different product)

| | |
|--|--|
| **Name** | Rhizome Agent |
| **Job** | Research + **memory** desktop: long-lived agent chat that can use and grow a local note vault |
| **Brain** | **Prime Agent** only (session, tools, skills, models, compaction). No multi-agent matrix. |
| **Memory SoT** | User’s **vault** (markdown notes on disk). Chat/session logs are operational, not the second brain. |
| **Audience** | Power users + small trusted circle; dense, keyboard-friendly, dark UI |
| **Not this product** | Full wiki graph-first shell, multi-CLI picker (Claude/Codex/Hermes as peers), auto-wiki every turn |

**Success feel:** “I opened Rhizome Agent to *work with Prime* and grow my vault.”  
**Failure feel:** “I opened my notes app and also have a chat rail.”

---

## 2. Design north star & references

**Pull craft from:**
- **Hermes Agent Desktop** — harness feels *native* inside chat (identity, working status, tools visible, session continuity). Use as craft bar only; **do not** copy Hermes branding.
- **Cursor / Windsurf agent panels** — transcript density, tool call cards, abort, multi-turn continuity.
- **ChatGPT desktop / Claude desktop** — calm primary conversation column (but we need *more* harness chrome: tools, skills, vault).
- **Existing Rhizome tokens** — near-black shell, muted borders, accent cyan/teal-green brand mark energy; monospace sparingly for paths/tools; shadcn-like controls (not skeuomorphic).

**Leave behind:**
- Dense PROJECTS / UNASSIGNED taxonomy as the home screen  
- Graph / network-shell as the hero  
- Multi-agent shopping list on first run  
- Bright SaaS marketing gradients, glassmorphism for its own sake, “AI purple”

**Aesthetic keywords:** dark, dense, calm, technical, local-first, trustworthy, harness-not-chatbot, memory-aware.

---

## 3. What to deliver (artboards)

Produce **4–6 high-fidelity desktop frames** (≈1440×900 or 1512×982). Prefer a consistent chrome across frames so they read as one app.

### Frame A — **Primary: Chat-first home (vault attached, agent working)**
The hero shot. Conversation is the main column. Show a live turn mid-flight.

### Frame B — **Tool results + Open-note split**
Same chrome; agent finished tools; user opened a note from a tool card. Note is **secondary** (right split or bottom/side panel), not a full app takeover.

### Frame C — **Promote / Save-to-vault**
Transcript with assistant message action row (copy / regenerate / **Save to vault** / fork). Optional toast: “Saved ‘Kernel notes’ to the vault”. Optional outcome card on a `create_note` tool.

### Frame D — **No vault (degraded but usable)**
Chat works. Clear badge: memory tools locked. CTA: Attach vault. Composer still shows Prime + model.

### Frame E — **First-run / Prime missing or not logged in**
Single-purpose empty/onboarding: install Prime / log in via `~/.prime`. **No** multi-agent list. Chat blocked or send disabled with same guidance.

### Frame F (optional) — **Session list / multi-conversation**
Lightweight conversation switcher (sidebar or top tabs): titles, working dots, new chat — not a full IDE project tree.

---

## 4. Vital components (must appear across the system)

Design these as a coherent kit. Label them in annotations if helpful.

### 4.1 App chrome
- **Window** — desktop app window; traffic lights; title **“Rhizome Agent”** (not “Rhizome” wiki).
- **Optional thin brand mark** — small asymmetric satellite / rhizome mark + wordmark in header or empty state only (don’t waste vertical space).
- **No** heavy Desktop command rail as the primary nav in v0 frames. If a rail exists, it is minimal: e.g. Chat · Vault · Settings (icons), with Chat selected.

### 4.2 Conversation (primary surface)
- **Transcript** — user bubbles vs assistant prose (markdown-ready: headings, lists, code, `[[wikilinks]]`).
- **Streaming state** — caret / subtle in-progress on latest assistant message.
- **Reasoning / thinking** — collapsible block (“Thought for 12s”), secondary to the answer; not a wall of chain-of-thought.
- **Error recovery** — inline error in thread + retry; never infinite spinner without **Stop**.
- **Empty transcript** — short harness empty state: “Ask Prime to research, search your vault, or draft something worth keeping.” Not a long Desktop AI essay.

### 4.3 Tool / harness activity
- **Tool call cards** in the transcript (not only a terminal dump):
  - Icon by tool type (search, read, write/create, shell, open)
  - Short label + **path** when known (`inbox/20260809-kernel-notes.md`)
  - Status: pending spinner · done · error
  - Expandable input/output (collapsed by default)
  - **Open** control on cards that have a note path (always visible, even when details exist)
- **Working status** in header or near composer:
  - Idle · Thinking · Running tools (n) · Error
  - Optional: last tool name
- **Abort / Stop** — obvious while running (composer or header).

### 4.4 Composer (bottom of main column)
Must include:
- **Multiline input** (placeholder: “Message Prime…” or “Ask Prime Agent…”)
- **Send** and **Stop** (stateful)
- **Prime identity** — mark + label “Prime” (not a multi-agent dropdown of peers)
- **Model display** — e.g. `xai / grok-4.5` (read-only OK in mock; chevron OK if it suggests future picker)
- **Vault chip** — attached vault name/path shortened, or “No vault”
- **Skills hint** (lightweight) — e.g. “Skills: rhizome-vault” or a small puzzle/skill affordance; don’t build a full skill store UI
- **Attach / references** (optional) — chip for “active note” context if a note is open
- **Permission / mode** — do **not** feature a Safe/Power product toggle for circle v0 (product locked: default toolkit only). If you show anything, a quiet “Vault tools on” is enough.

### 4.5 Memory loop (vault-aware)
Show the loop visually somewhere (Frame A annotations or Frame C):

```text
Chat → tools (search/read/create) → Promote/Save → Open note → later Search
```

Concrete UI pieces:
- **Save to vault** on assistant hover/focus actions (floppy or “Save to vault”)
- **Promote outcome** — toast and/or tool card for `create_note`
- **Vault attached badge** near composer or header
- **No-vault locked state** for memory tools (Frame D)
- **Open-note surface** — minimal editor: title, markdown body, save affordance, close/back to chat. Not full graph, properties taxonomies, or multi-tab IDE unless quiet secondary tabs.

### 4.6 Session / continuity
- **New chat** control (resets conversation; implies new Prime session)
- **Conversation list** (Frame F): titles auto or first message; archive optional
- Optional subtle **session id** or “Prime connected” for trust (power-user, small type)

### 4.7 Settings (one small inset or separate mini-frame OK)
Minimal:
- Vaults list / attach folder  
- Appearance (theme)  
- Link-out: “Models & login managed in Prime (`~/.prime`)” — **no** API key forms for providers in-app  

### 4.8 First-run (Frame E)
- Detect missing Prime or logged-out  
- Steps: Install Prime → run once / login → return  
- Single CTA path; Prime-only copy  

---

## 5. Layout rules (chat-primary)

**Target layout (Frame A/B/C):**

```text
┌──────────────────────────────────────────────────────────┐
│ Rhizome Agent          [vault: Laputa ▾]  [● tools 2] [—]│
├────────────┬─────────────────────────────────────────────┤
│ optional   │  Transcript (flex grow)                     │
│ slim       │   user …                                    │
│ conv list  │   assistant …                               │
│ or empty   │   ┌ tool: search_notes  done  [Open] ┐      │
│            │   └ path: wiki/foo.md               ┘      │
│            │   assistant continues…                      │
│            │   [hover actions: regen · copy · save · fork]│
│            ├─────────────────────────────────────────────┤
│            │  optional open-note split (Frame B)         │
│            ├─────────────────────────────────────────────┤
│            │  Composer: [Prime][model][vault]            │
│            │  [ text input                         ⏎ ]   │
└────────────┴─────────────────────────────────────────────┘
```

**Rules:**
1. **Conversation owns ≥55–65%** of width when no note is open.  
2. When a note opens, **chat remains visible** (split ~50/50 or 40/60). Do not navigate away to a pure editor route in the hero frames.  
3. Sidebar taxonomy (Inbox / Projects / …) is **not** the home; if shown, collapsed or behind “Vault”.  
4. Status bar: minimal or absent (no noisy multi-pill Desktop status bar).  
5. Density: comfortable for long sessions — 12–14px UI text, tight tool cards, generous transcript line-length (~65–75ch).

---

## 6. Content to put in the mock (so it feels real)

Use believable copy, not “lorem”:

**User:**  
“What did we decide about promote-to-vault vs auto-distill? Pull from the vault if it’s there.”

**Assistant (partial):**  
Short answer in prose. Mention a decision. Offer to save a crisp note.

**Tools shown:**
1. `search_notes` · query “promote vault” · done  
2. `get_note` · `wiki/decisions/memory-loop.md` · done · **Open**  
3. Optional `create_note` · `inbox/20260809-promote-vs-distill.md` · done · **Open**

**Composer model chip:** `xai / grok-4.5`  
**Vault chip:** `Laputa` or `~/Documents/Rhizome Vault`  
**Header status:** `Running tools` → then `Idle` on Frame B/C  

**Assistant actions (visible on hover in Frame C):** Regenerate · Copy · **Save to vault** · Fork  

---

## 7. Component inventory checklist (designer self-QA)

Every vital piece below should appear in at least one frame:

- [ ] App name Rhizome Agent  
- [ ] Prime mark + name (only agent)  
- [ ] Model display  
- [ ] Working / tools status  
- [ ] Stop / abort  
- [ ] New chat  
- [ ] Transcript user + assistant  
- [ ] Reasoning collapsed  
- [ ] Tool cards with status  
- [ ] Tool path + **Open**  
- [ ] Save to vault on assistant message  
- [ ] Vault attached chip  
- [ ] No-vault locked empty (Frame D)  
- [ ] Open-note secondary editor  
- [ ] Promote/save confirmation (toast or card)  
- [ ] First-run Prime missing (Frame E)  
- [ ] Settings hint: auth in `~/.prime`  
- [ ] Skills lightweight affordance  
- [ ] Conversation list or tabs (optional Frame F)  
- [ ] Dark dense visual language  

---

## 8. Explicit non-goals for this mock

- Full graph view, Mycelium citymap, or git “Changes” as hero (can be tiny future-rail ghosts only)  
- Multi-agent picker or onboarding carousel of CLIs  
- Safe vs Power toggle as a primary control  
- Mobile / phone layouts  
- Marketing landing page  
- Rebranding Prime or inventing a second agent runtime  
- Skeuomorphic “robot” mascots  

---

## 9. Output format preferences

1. **Desktop frames** at real laptop size, dark theme.  
2. **One component sheet** (optional): tool card states, composer anatomy, badges, toasts.  
3. **Short annotation layer** on Frame A calling out the memory loop and primary vs secondary surfaces.  
4. If the tool supports it: export **DESIGN.md** + PNG/WebP previews for eng handoff into `docs/design/`.  

---

## 10. Copy deck (use verbatim where possible)

| UI | Copy |
|----|------|
| Composer placeholder | Message Prime… |
| Header product | Rhizome Agent |
| Agent label | Prime |
| Working | Thinking… / Running tools… |
| Stop | Stop |
| New chat | New chat |
| Save action | Save to vault |
| Save toast | Saved “{title}” to the vault |
| No vault badge | No vault — memory tools locked |
| Attach CTA | Attach vault |
| Open tool | Open |
| Empty state | Ask Prime to research, search your vault, or draft something worth keeping. |
| Prime missing title | Prime Agent required |
| Prime missing body | Install Prime and sign in once. Rhizome Agent uses your local Prime session — keys stay in ~/.prime. |
| Skills | Skills · rhizome-vault |
| Model example | xai / grok-4.5 |

---

## 11. Interaction notes (for motion-aware tools)

- Tool cards: appear in order, pending → done (150–200ms).  
- Save to vault: actions fade in on assistant hover.  
- Open note: split panel slides from the right; chat stays mounted.  
- Stop: immediately returns composer to send state.  
Avoid loud confetti or success full-screen modals; prefer toast + card.

---

## 12. How this maps to engineering (for the designer’s confidence)

Already shipping or in progress in the app codebase (mock should not contradict):
- Long-lived Prime RPC session in-app  
- Tool cards in transcript  
- **Save to vault** on assistant messages  
- **Open** on tool cards when path is known  
- Vault skill tools: search / get / create / open  
- Prime-only product agent list  

The mock’s job is to show the **chat-primary shell** those features deserve — the current interim UI still feels too much like Desktop + right rail.

---

## 13. Prompt starter (paste into Open Design)

If the tool wants a short kickoff plus this file as context:

> Design high-fidelity dark desktop UI mockups for **Rhizome Agent**, a chat-first AI harness app powered only by **Prime Agent**, with optional local **vault memory** (search, open note, explicit save/promote). Primary surface is conversation + tool cards + composer (Prime identity, model, vault chip, working status, stop). Secondary surface is open-note split. Include frames: working chat, tool→open-note, save-to-vault, no-vault, Prime missing onboarding. Follow the full brief in `docs/design/2026-08-09-opendesign-harness-desktop-prompt.md`. No multi-agent matrix, no graph-first wiki home, no Safe/Power toggle. Aesthetic: dense, calm, local-first, Hermes-Desktop craft bar without Hermes brand.

---

## 14. Changelog

| Date | Change |
|------|--------|
| 2026-08-09 | Initial Open Design brief from v0 product lock + frontend roadmap + shipped promote/open-note. |
