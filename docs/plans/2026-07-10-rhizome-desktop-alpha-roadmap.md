# Rhizome Desktop — Combined Alpha Roadmap

**Status:** proposed (awaiting ratify)  
**Date:** 2026-07-10  
**Repo:** `knispo/rhizome-desktop` (private)

Merges three product threads into one sequence:

1. **Wiki saves** (correct place, project-aware, discoverable)
2. **Triggers** (automation/agent-first; manual power-user remains)
3. **Project-first navigation** (collapsible categories → projects → pages; orphans parked)

Also situates **MCP bridge (ADR-0152)** and leftover One Brain work so they don’t steal the alpha path.

### Source plans (detail)

| Thread | Detail plan |
|--------|-------------|
| Saves + triggers | Hermes: `2026-07-10_225519-wiki-saves-and-triggers-alpha.md` |
| Project-first nav | Hermes: `2026-07-10_230500-project-first-nav-wiki-structure.md` |
| MCP bridge | `docs/plans/2026-07-10-mcp-bridge-scope.md` + ADR-0152 |
| One Brain remainder | `docs/plans/2026-07-10-one-brain-post-step4-roadmap.md` |
| Destination vault idea | `docs/plans/2026-07-05-research-panel-future-ideas.md` |

When this roadmap and a detail plan disagree on **sequence**, this file wins. When they disagree on **API/layout detail**, prefer the detail plan + ADR.

---

## North-star alpha (definition of done)

A user can:

1. Treat **Rhizome Vault** as the agent/wiki brain (default write target).  
2. Drop or agent-ingest material → **pages land under a project** (or clearly **Unassigned**).  
3. Open the editor and **navigate categories → projects → pages** without wondering what a file is for.  
4. Still use **Research panel manually** when they want control.  
5. Ask/search finds **new pages soon** (post-write index hygiene).  
6. (Stretch) External MCP writes the **same** paths via Rust.

**Not required for this alpha:** Memory step 6, unified AI+Research panel redesign, Windows Authenticode, public docs site, full nested `wiki/projects/` migration.

---

## Product principles (locked)

| # | Principle |
|---|-----------|
| P1 | **Automation/agent default:** *arrive → reason → write wiki*. Manual is power-user, not the only story. |
| P2 | **Project is the unit of meaning** for wiki vaults. Types/folders stay secondary. |
| P3 | **Orphans are explicit:** Unassigned / Archive — never mixed into Active project lists. |
| P4 | **One write façade:** UI, inbox, and (later) MCP all call `rhizome_api` + `rhizome_write_location`. |
| P5 | **Vault roles:** personal notes vault ≠ agent wiki vault; different default nav and default write target. |
| P6 | **Ship vertical slices:** each phase leaves a demoable improvement. |

---

## Locked defaults (unless overridden)

| Decision | Default |
|----------|---------|
| Destination vault | `agent_memory_vault_path` → Rhizome Vault; not “whatever is open” |
| Inbox path | `<dest>/raw/inbox/` → process → `raw/processed/` |
| Auto matrix | text/md → Distill; files/URLs → Import; no auto-Generate in v1 |
| Missing project | **Unassigned** + toast “Assign to a project” |
| Categories | Free string on project hub; default **Active** |
| Nav for wiki vaults | **Projects** mode when `RHIZOME_VAULT.md` or `.rhizome/` present |
| Personal vaults | Keep Tolaria types + folders |
| Tree membership (alpha) | Virtual: `project:` frontmatter + path fallback `projects/<slug>/` |
| Layout migrate to `wiki/projects/…` | **After** virtual tree works (optional ADR) |
| Dual flat / nested `wiki/` read | Yes until migration |
| Auto-open note after write | Off |
| MCP packaging | Parallel track; **not** blocking inbox or nav |

---

## Architecture sketch

```text
                    ┌─ Triggers ─────────────────────────────┐
  raw/inbox drop ──►│                                        │
  agent MCP/tool ──►│  classify + resolve project            │
  Research panel ──►│  (manual / ambient / agent lanes)      │
                    └──────────────┬─────────────────────────┘
                                   ▼
                         rhizome_api (Rust)
                         write_location + events.jsonl
                         trigger: inbox|agent|manual
                                   ▼
                         Rhizome Vault (destination)
                         project hubs + pages
                                   ▼
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        Projects nav         Search reindex        History / toast
     (cat→project→page)      (Ask freshness)       (audit trail)
```

---

## Master sequence (phases)

### Alpha-0 — Product lock (docs)

- This roadmap in `docs/plans/`
- ADR: project-first nav + destination vault + inbox
- MCP ADR-0152 marked parallel, not critical path

**Gate:** ratify defaults (or list overrides).

### Alpha-1 — Write hygiene + project metadata

- Dual-layout flat/`wiki` read
- `project:` on all writers; empty → Unassigned policy
- Events: `trigger`, `project`, `artifact_path`
- Post-write search invalidate/rebuild
- Project hub stub on first assign

**Gate:** Manual Distill with `project: rhizome` → file + History + Ask finds it.

### Alpha-2 — Project-first navigation (virtual tree)

- Wiki-vault detect → default **Projects** sidebar mode
- Tree: Category → Project → kinds → pages
- Buckets: Unassigned, Archive, Inbox, Shared
- Types/Folders/All Notes remain as power modes

**Gate:** Expand `rhizome` → coherent set; random repos in Unassigned.

### Alpha-3 — Inbox ambient trigger

- `raw/inbox/` watcher → Distill/Import via `rhizome_api`
- Processed folder; `trigger:inbox`; Settings toggle

**Gate:** Drop file → page without opening Research panel.

### Alpha-4 — Destination vault + assign UX

- `agent_memory_vault_path`; first-run prompt
- Panel + inbox write to destination
- Assign Unassigned → project; button shows target vault

**Gate:** Personal vault open; research still hits Rhizome Vault.

### Alpha-5 — Cancel + MCP agent door (parallelizable)

- Cancel Generate/inbox jobs; global job indicator
- Continue `rhizome-tool` / MCP cutover (ADR-0152)
- Agents must pass/infer `project`

**Gate:** Cancel works; MCP Distill matches in-app paths (when bridge ready).

### Alpha-6 — Optional physical `wiki/projects/` layout (post-alpha)

Only if virtual tree + metadata insufficient.

---

## Critical path vs parallel

```text
Critical (solo usable alpha):
  Alpha-0 → 1 → 2 → 3 → 4

Parallel (all-agents alpha):
  Alpha-1 façade already done → MCP bridge Phases 2–4
  Alpha-5 cancel anytime after 3 starts
```

---

## Three save lanes

| Lane | Trigger | Project rule |
|------|---------|--------------|
| **A Ambient** | Inbox drop | Default project setting or Unassigned |
| **B Agent** | MCP / AI tools | Pass or infer project |
| **C Manual** | Research panel | User fields; Unassigned if empty |

---

## Demo script

1. Destination = Rhizome Vault  
2. Projects nav: category → project → pages  
3. Inbox drop → auto write  
4. Assign Unassigned → project  
5. Manual Generate with project  
6. Ask finds new page  
7. (Stretch) External agent same path  

---

## Explicit non-goals

Memory step 6 · unified AI+Research panel · Windows Authenticode · public Pages · cron full-vault re-extract · forcing physical layout before virtual nav  

---

## Immediate next

1. Ratify (or override defaults).  
2. ADR(s).  
3. Implement **Alpha-1 only** until gate demo.  
4. Then Alpha-2 against real Rhizome Vault.

---

## One-line strategy

**Make every write project-addressable, show the vault as a project tree, then automate intake — Research panel as power-user remote, not the front door.**
