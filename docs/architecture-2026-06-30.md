# Rhizome: Complete Architecture & Implementation Plan

**Author:** Hermes (acting as 20-year senior architect)
**Date:** 2026-06-30
**Context:** Synthesis of Grok-Wiki reverse engineering, Open Notebook study, Tolaria inspection, and existing Rhizome CLI

---

## 1. Executive Summary

Rhizome is an open-source desktop knowledge app where humans and AI agents share one markdown brain. It is not another note-taking app. It is not another AI research tool. It is the **control surface** for your agent memory — the vault where durable knowledge lives, the workshop where research happens, and the dashboard where agents connect.

The system integrates four reference architectures:

| Reference | License | Role | What we take |
|-----------|---------|------|-------------|
| **Tolaria** | AGPL | Desktop shell | Vault browser/editor, MCP bridge, Hermes agent support, multi-vault, git |
| **Open Notebook** | MIT | Research engine | Source processing pipeline, notebook model, chat/ask/transformations, podcast |
| **Grok-Wiki** | Proprietary | Repo analyzer | Research modes, two-phase generation, page quality harness, event streaming |
| **Rhizome CLI** | MIT | Core memory layer | search/lint/graph/research/repo-wiki, markdown vault as truth |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   RHIZOME DESKTOP (Tolaria fork)                    │
│  AGPL — Desktop UI Shell                                            │
│  ├─ Vault Browser / Editor (.md files with frontmatter)             │
│  ├─ Sidebar: Files | Projects | Research | Settings                  │
│  ├─ Command Palette (⌘K)                                            │
│  ├─ Git Status / Diff / Commit Panel                                │
│  ├─ Status Bar (sync state, agent status, vault info)               │
│  ├─ MCP Server (stdio + WebSocket)                                  │
│  ├─ External AI Setup Dialog (MCP config)                           │
│  │                                                                  │
│  └─ Pluggable panels:                                               │
│     ├─ 🗄️ Vault (browse/edit markdown — Tolaria's existing UI)      │
│     ├─ 🔬 Research Studio (notebooks, sources, chat, ask, podcast)  │
│     ├─ 📊 Repo Analyzer (modes, wiki gen, graph)                    │
│     ├─ ⚙️ Rhizome Settings (agents, vaults, providers, tools)       │
│     └─ 📜 Run History (events.jsonl viewer)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐        │
│   │           RHIZOME CORE (MIT — Python CLI + MCP)          │        │
│   │                                                          │        │
│   │  CLI Commands:                                           │        │
│   │  ├─ rhizome-search   — BM25 + semantic hybrid search     │        │
│   │  ├─ rhizome-lint     — Broken links, orphans, staleness  │        │
│   │  ├─ rhizome-graph    — Wikilink graph analysis           │        │
│   │  ├─ rhizome-research — Multi-round agent deep research   │        │
│   │  ├─ rhizome-repo-wiki— Repo → structured wiki pages      │        │
│   │  ├─ rhizome-temporal — Time-aware fact lookup            │        │
│   │  ├─ rhizome-memory   — Fact health analysis              │        │
│   │  ├─ rhizome-ingest   — Document → wiki page              │        │
│   │  ├─ rhizome-eval     — Retrieval quality measurement     │        │
│   │  └─ rhizome-grok-import — Import Grok-Wiki JSON          │        │
│   │                                                          │        │
│   │  MCP Tools (exposed to any connected agent):             │        │
│   │  ├─ rhizome_search, rhizome_lint                         │        │
│   │  ├─ rhizome_graph_summary, rhizome_repo_research         │        │
│   │  ├─ rhizome_generate_wiki (two-phase: plan → pages)      │        │
│   │  └─ .rhizome/events.jsonl logging (all tool calls)       │        │
│   │                                                          │        │
│   └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐        │
│   │     RESEARCH STUDIO (MIT — adapted from Open Notebook)   │        │
│   │                                                          │        │
│   │  Key workflows (LangGraph-based):                        │        │
│   │  ├─ Source Processing: extract → chunk → embed → save    │        │
│   │  ├─ Chat with Sources: conversational, pick context      │        │
│   │  ├─ Ask: auto RAG across all sources in notebook         │        │
│   │  ├─ Transformations: template-based extraction           │        │
│   │  └─ Podcast: outline → dialogue → TTS audio             │        │
│   │                                                          │        │
│   │  Storage: SurrealDB (graph + vector, cache layer)        │        │
│   │  Final outputs → Rhizome markdown vault                  │        │
│   │                                                          │        │
│   └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐        │
│   │     REPO ANALYZER (inspired by Grok-Wiki)               │        │
│   │                                                          │        │
│   │  Two-phase generation:                                   │        │
│   │  Phase 1: Structure agent → XML plan                     │        │
│   │  Phase 2: Page agents → N wiki pages                     │        │
│   │                                                          │        │
│   │  Research modes (15+): architecture, hidden-lessons,     │        │
│   │  worth-stealing, first-hour, mental-model, etc.          │        │
│   │                                                          │        │
│   │  Output: sources/repos/<slug>/*.md + events.jsonl        │        │
│   │                                                          │        │
│   └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐        │
│   │           EXTERNAL AGENTS (bring your own)               │        │
│   │                                                          │        │
│   │  Hermes · Claude Code · Codex · OpenCode · Cursor        │        │
│   │  └─ All connect via MCP to Rhizome tools                 │        │
│   │  └─ All have permission modes (Safe / Power User)        │        │
│   └─────────────────────────────────────────────────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

         ┌─────────────────────────────────────────────────────┐
         │           THE VAULT (source of truth)               │
         │                                                     │
         │  /Users/.../Rhizome Vault/                          │
         │  ├─ entities/     — Durable knowledge entities      │
         │  ├─ concepts/     — Cross-cutting concepts          │
         │  ├─ projects/     — Project-specific context        │
         │  │  └─ <slug>/   — Notebook = project directory     │
         │  │     ├─ index.md                                  │
         │  │     ├─ sources/ — Raw imports (PDFs, web exports)│
         │  │     ├─ notes/   — AI-generated insights          │
         │  │     └─ research.md — Chat logs, transformations  │
         │  ├─ sources/repos/ — Generated repo wiki pages      │
         │  │  └─ <slug>/    — Architecture, patterns, etc.    │
         │  ├─ queries/      — Research results                │
         │  ├─ synthesis/    — Cross-reference summaries       │
         │  ├─ raw/          — Drop zone for new sources       │
         │  ├─ .rhizome/     — Operational state               │
         │  │  ├─ events.jsonl — Tool call log                 │
         │  │  ├─ runs/       — Research run records           │
         │  │  └── repo-cache/ — Cached repo analysis          │
         │  ├── AGENTS.md    — Instructions for external agents│
         │  └── RHIZOME_VAULT.md — Marker file                 │
         └─────────────────────────────────────────────────────┘
```

---

## 3. Key Architectural Decisions

### Decision 1: Markdown is the source of truth. SurrealDB is the research cache.

**The mistake NOT to make:** Trying to make SurrealDB the primary store and sync it with markdown. This creates a distributed state problem with no clean winner.

**The right approach:** Open Notebook's SurrealDB stores notebook/source/note data for the *research studio* only. It's a cache/index layer for active research sessions. When research is complete, the final outputs are written as markdown to the Rhizome vault. The SurrealDB can be wiped and rebuilt from the markdown. This is the "Filesystem is the source of truth, cache is reconstructible" pattern from Tolaria's own architecture doc.

**One authority, three representations:**
1. **Filesystem** — `.md` files on disk (THE authority)
2. **SurrealDB** — Active research cache (reconstructible)
3. **React State** — In-memory during session (disposable)

### Decision 2: Fork Tolaria for the desktop shell. Accept AGPL.

**The mistake NOT to make:** Building a desktop shell from scratch "to stay MIT." The desktop shell is not the unique value — the vault, research studio, and repo analyzer are. Tolaria already has:
- A production-quality markdown editor (BlockNote + CodeMirror + tldraw)
- MCP server and WebSocket bridge
- Hermes, Claude Code, Codex agent support
- Git-first workflow
- Multi-vault and file watcher
- 3,000+ tests

**The tradeoff:** Tolaria is AGPL. This means Rhizome Desktop must be AGPL. Rhizome Core (CLI + MCP) stays MIT. The desktop app is the AGPL shell that calls the MIT core. This is standard practice (many projects have AGPL UI + MIT library).

### Decision 3: Extract Open Notebook's workflows as a library, don't fork the app.

**The mistake NOT to make:** Forking Open Notebook's full Next.js + FastAPI + SurrealDB stack and trying to embed it in Tolaria. Two different UI frameworks, two databases, two state management systems, conflicting routing.

**The right approach:** Open Notebook's unique value is in its **LangGraph workflows** (source extraction, chat, ask, transformations, podcast). These are Python functions that take inputs and return outputs. We extract them into a `rhizone-studio` Python package that Rhizome Core can call directly. The desktop app's Research Studio panel provides the React UI, the Rhizome CLI provides the MCP tools, and the `rhizone-studio` library provides the workflow logic.

**What we actually use from Open Notebook:**
- `graphs/source.py` — Content ingestion pipeline (MIT)
- `graphs/chat.py` — Conversational agent (MIT)
- `graphs/ask.py` — Multi-search synthesis (MIT)
- `graphs/transformation.py` — Template-based extraction (MIT)
- `podcasts/` — Podcast generation (MIT)
- `domain/notebook.py` — Data models (MIT)
- `domain/credential.py` — Encrypted credential system (MIT)
- `utils/embedding.py` — Embedding helpers (MIT)

**What we replace:**
- SurrealDB → SQLite + file-based storage (for constiency with Rhizome's markdown-first approach)
- Next.js frontend → Tolaria's React frontend panel
- FastAPI backend → Rhizome CLI MCP tools
- Password auth → Tolaria's local-only model

### Decision 4: Implement Grok-Wiki patterns as Rhizome CLI + MCP, not as a separate service.

**The mistake NOT to make:** Running Grok-Wiki as a sidecar and wiring it in. Its server bundle has proprietary concerns and unpredictable behavior.

**The right approach:** Grok-Wiki's value is in its **prompt patterns and workflow architecture**. These are implementation details that sit naturally in the Rhizome CLI:

- **Two-phase generation** → Add `rhizome-generate` command (structure plan + page agents)
- **Research modes** → Add `--mode` flag to `rhizome-repo-wiki` with the 15 modes
- **Page quality harness** → Add quality checks + auto-retry to `rhizome-generate`
- **Event streaming** → Already implemented in `.rhizome/events.jsonl`

### Decision 5: External agents are the primary AI interface, not an in-app chat.

**The mistake NOT to make:** Building a full AI chat panel in the app when users already have Hermes, Claude Code, Cursor, etc.

**The right approach:** The app provides:
- **MCP tools** so agents can read/write/search the vault
- **Context snapshots** so agents know what the user is looking at
- **Run history** so agents can see past research
- **Approval panels** for write operations

The actual chat happens in whatever agent the user prefers. The app is the vault and control surface, not the chat UI.

### Decision 6: Notebooks map to project directories.

**The mistake NOT to make:** Creating a separate SurrealDB-backed notebook system that's disconnected from the markdown vault.

**The right approach:** Each Open Notebook-style notebook becomes a `projects/<slug>/` directory in the Rhizome vault. The sources are stored as markdown files. The notes are markdown files. The chat history is a markdown file. Everything is files, everything is searchable by `rhizome-search`, everything is versioned by git.

**What SurrealDB is used for:**
- Active session state (vector embeddings, chat history, job status)
- Cache/research artifacts that can be regenerated
- NOT the durable source of truth

---

## 4. What to Build First (Implementation Priority)

### Phase 1: Vertical Slice (CURRENT — nearly done)
1. ✅ Tolaria fork as Rhizome Desktop
2. ✅ Rebrand (package.json, tauri.conf.json, MCP server names)
3. ✅ Rhizome MCP tools (search, lint, graph, repo_research, generate_wiki)
4. ✅ Research mode prompts document
5. ✅ Grok-Wiki architecture reference
6. ✅ `.rhizome/events.jsonl` logging
7. ⬜ Grok-Wiki JSON importer
8. ⬜ Vault detection helper (RHIZOME_VAULT.md, .rhizome/ presence)

### Phase 2: Research Studio Base
1. Extract Open Notebook's source processing pipeline as `rhizone-studio`
2. Add source upload/import UI to desktop app
3. Add notebook browser (sidebar Project view)
4. Add "Chat with Sources" as a desktop panel
5. Add "Ask" as a research action

### Phase 3: Repo Analyzer
1. Implement `rhizome-generate` with two-phase generation
2. Add research mode selector in desktop app
3. Add page quality harness with auto-retry
4. Add wiki output viewer in desktop app

### Phase 4: Studio Expansion
1. Add transformation templates
2. Add podcast/audio briefing generation
3. Add PDF export for research pages
4. Add run history viewer
5. Add Grok-Wiki import wizard

---

## 5. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AGPL license limits adoption | Medium | Rhizome Core stays MIT. Desktop is AGPL. Most value is in the CLI/MCP layer. |
| Open Notebook's SurrealDB adds complexity | Medium | Use SurrealDB only as research cache. Markdown is the durable layer. Can swap SurrealDB for SQLite later. |
| Two UI frameworks (Tolaria React + Open Notebook React) | Low | Both use React. Open Notebook's Next.js frontend is replaced by Tolaria's desktop panels. No conflict. |
| Grok-Wiki patterns require agent orchestration | Medium | The structure agent phase needs a local agent (Hermes/Claude). The MCP tool shells out. |
| Feature creep kills momentum | High | Ship Phase 1 first. Add studio features one at a time. Don't try to launch with everything. |
| Desktop app has no users | Low | The CLI + MCP tools work standalone. The desktop is the UI on top. Agents can use Rhizome without the app. |

---

## 6. Thing Process

The architecture is not about code. It is about data flow:

```
Sources (PDF/web/repo) → ingest → markdown vault ← queried by agents
                                          ↓
                                    Desktop app (read/approve/export)
                                          ↓
                                    Podcast / PDF / share
```

Every piece feeds the markdown vault. The vault is the center. Everything reads and writes to it. No silos, no locked-in formats, no databases that can't be rebuilt.

**The three questions that drove every decision:**

1. **Is the data durable?** Yes — markdown files in a git repo.
2. **Can agents use it directly?** Yes — no special parsing needed.
3. **Can users leave?** Yes — they keep their files.

Everything else — the React UI, the SurrealDB cache, the MCP server — is services layer that makes this easier but is never required to access the actual knowledge.
