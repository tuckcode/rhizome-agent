# Grok-Wiki Architecture Extraction — Rhizome Implementation Reference

Extracted from the running Grok-Wiki server bundle (`rlm-wiki.js`) on macOS. Independently described, not copied code. Use as reference for implementing Rhizome Agent's Research panel and grok-import (`ResearchPanel.tsx`, `src-tauri/src/rhizome_grok_import.rs`) — written pre-fork when this repo was still Rhizome Desktop, but the features it describes now live here, not there.

## 1. Wiki Generation Pipeline (Two-Phase)

### Phase 1: Structure Agent
1. Takes repo URL/path + depth + style + page count
2. Spawns a single agent to explore the repo and produce XML structure
3. Output: `<wiki_structure>` XML with sections, page refs, relevant files
4. Retries once if XML parsing fails
5. Timeout: 5 min (configurable), idle timeout: 5 min

### Phase 2: Page Agents
1. Takes structure XML + depth + style per page
2. Spawns one agent per page (parallel with concurrency limit)
3. Quality check after first attempt — retries with specific feedback if fails
4. Output: Markdown page inside `<ANSWER>` block
5. Max LLM calls: 200 per agent
6. Max iterations: varies by depth (up to 35)

### Structure XML Schema
```xml
<wiki_structure>
  <title>Wiki Title</title>
  <description>1-2 sentence description</description>
  <sections>
    <section id="section-xxx">
      <title>Section Title</title>
      <pages>
        <page_ref>page-overview</page_ref>
        <page_ref>page-xxx</page_ref>
      </pages>
      <subsections></subsections>
    </section>
  </sections>
  <pages>
    <page id="page-overview">
      <title>Start Here / Overview</title>
      <description>What this page covers</description>
      <relevant_files>
        <file_path>README.md</file_path>
        <file_path>src/main.ts</file_path>
      </relevant_files>
      <related_pages>
        <related>page-xxx</related>
      </related_pages>
      <parent_section>section-xxx</parent_section>
    </page>
  </pages>
</wiki_structure>
```

## 2. Page Count Logic

### Depth → Default Page Count
| Depth | Default Pages | Budget |
|-------|--------------|--------|
| Fast | 10 | Fast wiki: concise, selective |
| Regular | 18 | Standard wiki |
| Deep | 30 | Deep / expensive |

### Auto Page Count Ranges
| Max Pages | Min | Max |
|-----------|-----|-----|
| ≤1 | 1 | max |
| ≤6 | min(2, max) | max |
| ≤12 | 3 | max |
| ≤24 | 6 | max |
| >24 | 10 | max |

### Mode: `auto` (default) vs `fixed`
- Auto: chooses smallest useful number between min-max
- Fixed: must emit exactly N pages

## 3. Research Modes / Styles (15 styles)

| Mode | Opening Title | Best For |
|------|--------------|----------|
| Architecture | Architecture Overview | Entry points, data flow, abstractions |
| First Hour | Start Here | Newcomer onboarding |
| Mental Model | The Mental Model | Flows, invariants, boundaries |
| Socratic Exploration | The First Question | First-principles understanding |
| Feature Scout | Feature Scout Brief | Product surface, CLI, UI |
| Worth Stealing | What Is Worth Stealing | Reusable patterns |
| Hidden Quirks | Hidden Quirks Map | Non-obvious implementation details |
| Pattern Discovery | — | Cross-repo pattern comparison |
| Repo Comparison | — | Compare repos or subsystems |
| Debugging Atlas | — | Failure modes, observability |
| Tech Reader | — | HN/TechCrunch-style brief |
| Documentation | — | Formal MDX docs |
| ELI5 | Explain It Simply | Beginner-friendly |
| Custom | — | User-defined format |
| Basic | — | Balanced default |

## 4. Beyond README Requirement

Applied to all "discovery" styles (feature-scout, worth-stealing, hidden-quirks, pattern-discovery, etc.):
- README may orient but must not dominate
- Actively surface: **code paths, tests, config, examples, prompts, adapters, generated assets, scripts, hidden constraints, implementation boundaries**
- A page is weak if it merely restates README claims
- Prefer non-README evidence unless README is the only source

## 5. Page Quality Harness

After first page generation, checks for:
- Minimum content length (600/700/900 chars depending on depth)
- Citation quality
- Format requirements
- Retries once with specific quality issue feedback
- Falls back gracefully if retry also fails

## 6. Local CLI Sidecar Architecture

### Process Model
1. Main process spawns sidecar as child process: `bun rlm-wiki.js sidecar --host 127.0.0.1 --port 0 --token <random> --stamp <tmpfile>`
2. Port 0 = random available port
3. Sidecar writes stamp file with host/port/token
4. Parent waits up to 10s for stamp file
5. All subsequent communication via HTTP fetch against stamp URL
6. Token sent as `Authorization: Bearer <token>` header

### Agent Discovery
- Sidecar exposes `/v1/agents` endpoint
- Response: `{enabled: bool, agents: [{id, name, bin, path, installed, runnable, models, ...}]}`
- 6 agent IDs: grok, codex, claude, pi-codex, pi-claude, antigravity
- Agent readiness cached with 5-minute TTL
- Rescan forces cache refresh

### Run Execution
1. POST `/v1/runs` with request body → returns `{runId}`
2. GET `/v1/runs/{runId}/events` → server-sent events stream
3. Events: start, step (reasoning/code/output), submit (answer), error, done
4. Cancel: signals abort, sends cancel to sidecar

### Terminal Workspaces
- POST `/v1/terminal-workspaces` → creates workspace dir, returns `{id, cwd}`
- DELETE to release
- Used as working directory for agents

### Environment Filtering
- Sidecar passes proxy/NO_PROXY/CA bundle from login shell
- Filters out provider API keys from child processes
- Preserves BYOK/BYOC boundaries

## 7. SQLite Concurrency

| Setting | Normal | High-frequency Writes |
|---------|--------|----------------------|
| Busy timeout | 30,000ms | 500ms |
| Retry delays | none | [50ms, 100ms] |
| Journal | WAL | WAL |

Env vars: `RLM_WIKI_SQLITE_BUSY_TIMEOUT_MS`, `RLM_WIKI_SQLITE_WRITE_BUSY_TIMEOUT_MS`, `RLM_WIKI_SQLITE_WRITE_BUSY_RETRY_DELAYS_MS`

## 8. Product Store (Run/Event History)

### Run kinds
- `wiki_generate`
- `ask`
- `distill`

### Event types (in order)
- start, phase, structure-start, structure-agent, structure-done
- page-start, page-agent, page-done
- merge-start, merge-done
- done, error, answer

### Artifact history
- Artifacts stored with versioning: `rlm_product_artifacts` + `rlm_product_artifact_versions`
- Each artifact has kind, key, data, run association
- Diffs/changes tracked across versions

## 9. Concurrency Limits

| Operation | Max Concurrent |
|-----------|---------------|
| Generate | 2 global |
| Ask | 5 global, 3 per user |
| Code | 3 global |
| Review | 5 global |

## 10. Knowledge Profiles

Compound Engineering pack:
- Skills bundled from EveryInc/compound-engineering-plugin
- Capabilities: ce-plan (plan), ce-doc-review (QA review)
- Configurable: mode, packId, packName, author, provenance, sources, capabilities

## 11. API Endpoints (Key Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check + status |
| `/api/generate` | POST | Start wiki generation |
| `/api/ask` | POST | Start Ask session |
| `/api/run/{id}` | GET | Get run status |
| `/api/run/{id}/stream` | GET | Stream run events |
| `/api/run/{id}/cancel` | POST | Cancel run |
| `/api/local-cli/agents` | GET | List installed agents |
| `/api/wikis` | GET | List generated wikis |
| `/api/skills` | GET | List skills |

## 12. Agent Definition Model

```typescript
interface AgentDefinition {
  id: string        // grok | codex | claude | pi-codex | pi-claude | antigravity
  name: string      // Human-readable label
  bin: string       // Binary name on PATH
  path: string|null // Resolved path
  installed: bool
  runnable: bool
  version: string|null
  authStatus: string // unknown | missing | ready
  models: string[]   // Available models
  defaultModel: string
  reasoningOptions: string[]
  setupHint: string
}
```

## 13. CLI Command Shape (Grok-Wiki CLI)

```bash
grok-wiki generate <owner/repo> [--agent <agent>] [--pages N] [--style <style>] [--page-count-mode auto|fixed]
grok-wiki ask <owner/repo> "<question>" [--agent <agent>] [--mode deep|fast]
grok-wiki agents [--rescan]
```

## 14. Custom Format Prompt Support

- Style "custom" accepts a prompt string (max 2400 chars)
- The prompt shapes audience, tone, examples, section titles, explanation style
- Must not override repository-grounding or source citations
- Falls back to Basic style if no prompt provided
