# Rhizome Agent — v0 product brief & roadmap

Status: **agreed 2026-08-09** via `/grill-with-docs` (rounds 1–5).
Frontend/IA: `docs/plans/2026-08-09-rhizome-agent-frontend-design-roadmap.md`.  
Glossary: root `CONTEXT.md`.  
Session host spike (slice 1): `2026-08-09-prime-harness-chat-spike.md`.

## 1. One-liner

**Rhizome Agent** is a research and **memory** desktop app. **Prime Agent** is the built-in harness (session, tools, skills, models, compaction). The vault is where durable knowledge lives; chat works without a vault, and gets powerful when one is attached.

## 2. Audience

- **v0:** Atticus + small trusted circle  
- **Not yet:** stranger-facing launch, Desktop feature parity marketing  

## 3. Job to be done

Primary: **long-lived Prime chat** that can **use and grow a Rhizome vault** (search, open notes, **explicit save/promote**).

Not v0: second full wiki/PKM product; multi-CLI agent matrix as product; silent auto-maintained wiki.

## 4. North-star references

| Reference | Use |
|-----------|-----|
| **Hermes Agent Desktop** | Bar for “harness feels native inside a chat desktop” (install depth, status, tooling presence). Internal craft bar — not the external brand story. |
| **Prime Agent** | Only runtime; RPC host already landed; skills/providers/continual harness are Prime’s. |
| **Selective harness doctrine** | What to take from Hermes / DeepSeek / others: contracts and artifacts, never organs. `docs/design/harness-doctrine.md`, ADR-0168. |
| **Rhizome vault method** | Durable memory SoT; MCP + open-note + promote. |

## 5. Product principles (locked)

1. **Prime is the only agent** in the UI. Models = Prime providers. Legacy Desktop agent backends stay hidden until pruned.  
2. **Vault is SoT for durable knowledge.** Prime session + continual harness stay operational; they are not the wiki.  
3. **Memory loop:** chat → work → **promote/save into vault** → search/open later. At least one first-class save path in v0.  
4. **No vault required to chat.** Attach vault to unlock memory tools and promote.  
5. **Default toolkit** (vault skill first); no Safe/Power product mode for circle v0 — extend via more Prime skills. *(Was Safe/Power; reframed 2026-08-09.)*  
6. **Chat-first UX** with enough note UI to open/edit from tools (not full Desktop chrome).  
7. **Circle v0 may BYO `prime-agent`.** Bundled runtime is a later phase exit criterion.  
8. **v0 harness depth = core loop + skills/extensions + working status.** Broader Hermes-like *feel* is post-v0 and user-pulled. It is not command-count parity with Prime, and it is not a license to graft other runtimes. See `docs/design/harness-doctrine.md` (ADR-0168).

## 6. v0 exit checklist (trusted circle)

On a machine that can install the app + Prime (BYO):

- [x] Multi-turn Prime chat in-app (same long-lived host; abort + new session) — eng shipped + dogfood PASS (`8ae177e`, session status 03:49)  
- [x] Auth/models via `~/.prime` (no app-stored provider API keys) — settings pruned; posture documented (§8 P1-3)  
- [x] At least one skill/extension path works and is visible enough to trust — `rhizome-vault` skill + Skills chip (`204822a`)  
- [x] Clear “agent working / tools running” status — status + model chrome (`73b2676`, dogfood PASS)  
- [x] Attach vault → search/read via tools — vault CLI tools PASS in dogfood  
- [x] **Save or promote one durable note into the vault and reopen it** — `2381f68` (+ tests)  
- [x] Open-note from a tool/promote result — `e2cd77f` (+ tests)  
- [x] Default vault toolkit seeded; no mandatory Power toggle (circle v0) — `2381f68`, chrome `204822a`  
- [x] Other agent backends not offered in UI — Prime-only product picker (`204822a`/`fa230a6`)  

> **2026-08-09 refresh:** all 9 eng criteria shipped. Remaining sign-off = one **native** (`pnpm tauri dev`) pass of the promote→open loop by the user (on their machine, BYO Prime). Packaging phase exit (bundled runtime) is separate — see §8 P4b.

**Packaging phase exit (later):** same loop with **bundled** Prime/runtime (no CLI install for friends).

## 7. Non-goals (v0)

- Bundling Node/Prime in the first circle dogfood build (tracked as phase 4b)  
- Full Desktop multi-agent picker  
- Full graph/onboarding/spotlight tour parity  
- Auto-sync every turn into the wiki  
- Dual-write vault + harness as equal durable stores  
- Sharing git history/remote with `knispo/rhizome`  

## 8. Product phases

### Phase 1 — Chat works

**Outcome:** Daily multi-turn Prime chat is the product center.

**Status (2026-08-09 refresh):** ENG COMPLETE — Prime default target, stream/abort/new-session, Prime-only picker, auth posture documented. Remaining: native dogfood sign-off.

Eng (under this phase):

1. ~~Frontend **Prime** target → `stream_prime_session` / status / abort / new session~~  
2. ~~Prime-only UI (hide legacy agent backends; flag OK)~~  
3. Auth posture: document + rely on `~/.prime` (no new key vault in settings)  
4. Stream UX: text, thinking, tool cards, errors, Done (inherits existing stream UI)  

**Depends on:** session host spike (done).

### Phase 2 — Harness depth

**Outcome:** Feels like a harness desktop, not a thin RPC pipe.

**Status (2026-08-09 refresh):** Skills chip + rhizome-vault toolkit shipped (`204822a`/`2381f68`); working status + model display chrome (`73b2676`). Remaining: in-app model picker, host hardening (reconnect/cwd/vault-switch policy). 

Eng:

1. Skills/extensions discovery from user/project Prime paths  
2. Working/status chrome (tools running, session id/name if cheap)  
3. Model **display** from Prime state → then **in-app model picker** (`set_model` / cycle)  
4. Harden host: reconnect, cwd/vault switch behavior, extension-UI policy  

### Phase 3 — Vault-aware memory

**Outcome:** Memory loop is real.

**Status (2026-08-09 refresh):** ENG COMPLETE for circle v0 — MCP via skill+CLI (`88b0fe0`, GH #1 documents why not host HTTP), promote (`2381f68`), open-note (`e2cd77f`); Safe/Power replaced by default-toolkit decision (product principle #5). Vault chrome retained for open/edit.

Eng:

1. Inject **Rhizome MCP** into Prime session  
2. **Safe / Power** policy (sketch: Safe = read/search + limited capture/promote writes; Power = broader edit)  
3. **Save/promote** first-class path (tool and/or explicit UI control)  
4. **Open-note** from tool results / promote targets  
5. Keep vault chrome needed for open-edit; don’t strip note paths while this lands  

### Phase 4 — Circle-ready

**Outcome:** Trusted circle can run the v0 checklist.

Eng:

1. Install/run docs for BYO Prime + login (incl. xAI OAuth as needed)  
2. Dogfood fixes from checklist failures  
3. **4b — Bundled runtime** (separate exit): ship Prime/Node (or equivalent) inside app distribution  

### Phase 5 — Later (post-v0)

- User-pulled Prime surfaces (queue, subagent tree, schedules, refine, model/auth catalog) as Rhizome UX over Prime — not command-count parity, not a second runtime (ADR-0168)  
- Hard-delete unused Desktop DNA (dead agent adapters, unreachable panels)  
- Optional: multi-vault sessions, full session library UI, deeper continual-harness↔vault bridges  

## 9. Eng priority order (single queue)

Use when sequencing tickets (matches grill Q26):

1. UI Prime target + Prime-only chrome  
2. Auth polish (`~/.prime` only)  
3. **MCP + Safe/Power + save/promote + open-note** (one phase, don’t split save to “someday”)  
4. Skills / status / model picker  
5. Prune hidden legacy backends & competing chrome  
6. Bundle runtime  

## 10. Prune policy

| Surface | Policy |
|---------|--------|
| Other **agent backends** / multi-agent matrix chrome | Hide as soon as Prime is default (phase 1); delete after circle dogfood |
| **Vault** chrome required for open-note / edit | Keep until phase 3 memory loop works |
| Graph, Desktop onboarding, unused panels | Defer; hide if they steal focus from chat; no big-bang delete in phase 1 |

## 11. Memory architecture (decision summary)

```
┌─────────────────────────────────────────────────────────┐
│ Rhizome Agent UI (chat-first)                           │
│  stream ↔ prime_session_host (RPC) ↔ prime-agent        │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              ▼                           ▼
   ~/.prime/agent/              Vault (when attached)
   sessions, skills,            notes / wiki / search
   continual harness            MCP tools + promote/save
   (operational)                ★ durable SoT ★
```

- **Do not** treat session JSONL or harness memories as the user’s second brain.  
- **Do** make promotion obvious and trustworthy.  
- Research is open-ended with Prime tools; vault grounds when attached.

## 12. Open implementation questions (not product forks)

Track in issues / tickets when executing — already decided enough to build:

- Exact Safe tool allowlist and path guards  
- Promote UX: slash/tool vs button vs both  
- Bundle strategy (sidecar, embedded Node, updater story)  
- Whether menu-bar capture returns in Agent or stays Desktop-only  
- Session host: multi-window / vault switch edge cases  

## 13. Suggested next skill steps

1. Optional: GitHub issues from phase 1–3 slices (`/to-tickets` when a phase is ready to burn down)  
2. **Implement phase 1** (Prime UI target) against this doc — TDD per `AGENTS.md`  
3. Re-open `/grill-with-docs` only if a phase exit criterion proves wrong in dogfood  

## 14. Changelog

| Date | Change |
|------|--------|
| 2026-08-09 | Initial brief + roadmap from grill-with-docs (Q1–Q30 locked). |
| 2026-08-09 | Status refresh: all 9 v0 exit criteria eng-shipped (`2381f68`→`056cb75`); phases 1+3 eng complete. |

## Mycelium (named 2026-08-09)

Agent **run footprint** rail destination **with Graph**. Mindwalk-class visualization; Prime-on-Pi + bridge. See `docs/plans/2026-08-09-mycelium-run-map.md`. Parallel track — not a substitute for promote/save.
