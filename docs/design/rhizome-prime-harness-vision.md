# Rhizome as a memory-native agent harness

Design vision (draft). Product shape only. The ratified take/leave rule is
[`harness-doctrine.md`](./harness-doctrine.md) (ADR-0168).

## The idea in one line

**Rhizome becomes the desktop product: a local memory OS and agent shell. [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) becomes the execution engine (RLM / long-running harness). [Hermes Agent](https://hermes-agent.nousresearch.com/) is only the quality bar—not the stack.**

## Problem

Coding agents (Hermes-class, [OpenCode](https://opencode.ai/), Claude Code, Prime, etc.) are strong at **doing work**—tools, sessions, long runs, multi-step control loops. They are weak at **lasting personal/organizational knowledge**: typed structure, human-editable notes, relationships, research ingestion, git history, a real editor.

PKM apps are strong at **notes and structure**. They usually bolt on weak chat and never become a serious agent control plane.

The gap: **a desktop product where durable memory and a serious agent runtime are one system**, with the vault as source of truth.

## What Rhizome already is

- **Local-first vault** (markdown + git), not a proprietary cloud store  
- **Opinionated knowledge method** (types, relations, capture → organize → use)  
- **Real editor** (BlockNote / rich note experience) replacing the need to live in Obsidian for day-to-day writing  
- **Research panel** (library, ask, distill, import/repo research, jobs)  
- **AiWorkspace** (docked/pop-out multi-chat, agent targets, permission modes)  
- **Multi-agent adapters** (already launches external CLIs—including Hermes and OpenCode—into the vault via MCP/safe modes)

Public product / source: [tuckcode/rhizome-agent](https://github.com/tuckcode/rhizome-agent) (private). Rhizome Desktop remains at [knispo/rhizome](https://github.com/knispo/rhizome) (AGPL) — a separate repo; see `docs/IDENTITY.md`.

Rhizome’s strength is **memory architecture and desktop shell**, not “we rebuilt the best RLM from scratch.”

## What Prime Agent is (in this plan)

[Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) (MIT, [Prime Intellect](https://www.primeintellect.ai/)) supplies the **agent infrastructure**:

| Piece | Links / notes |
|--------|----------------|
| Product / install | [GitHub](https://github.com/PrimeIntellect-ai/prime-agent), [install script](https://app.primeintellect.ai/prime-agent/install.sh), [blog announcement](https://www.primeintellect.ai/blog/prime-agent) |
| RLM (prompt-as-variable, subagents as code) | [RLM blog](https://www.primeintellect.ai/blog/rlm), [docs/rlm](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/rlm.md) |
| Continual harness / refine | [paper](https://arxiv.org/abs/2605.09998), agent docs under `packages/coding-agent/docs/` |
| Architecture (daemon, workers, TUI as client) | [architecture.md](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/architecture.md), [daemon.md](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/daemon.md), [long-running agents](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/long-running-agents.md) |
| Embedding a custom UI | [RPC mode](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/rpc.md), [SDK](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/sdk.md), [quickstart](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/quickstart.md) |
| Related stack | [pi](https://github.com/earendil-works/pi) (TUI/agent base), [verifiers](https://github.com/PrimeIntellect-ai/verifiers), [PRIME-RL](https://github.com/PrimeIntellect-ai/prime-rl) |

Rhizome would **not** reimplement that stack. It would **host and drive** it—the same way Prime’s own TUI is just a client on the daemon.

## Comparison references (not the chosen stack)

| Project | Role in this vision | Links |
|---------|---------------------|--------|
| **Hermes Agent** | Quality bar for multi-provider / long-run agent *feel*; optional backend later, not the RL core | [Docs](https://hermes-agent.nousresearch.com/), [xAI OAuth guide](https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth) |
| **OpenCode** | Example of a shipping coding-agent desktop; **not** the preferred product base if Prime is the engine | [opencode.ai](https://opencode.ai/), [anomalyco/opencode](https://github.com/anomalyco/opencode) |
| **Claude Code / Codex / Pi** | Already pluggable engines via Rhizome adapters | (in-app agent picker) |

## How the pieces fit

```text
Rhizome (product)
  • Vault memory OS
  • Editor, graph, research, distill
  • Desktop UX (sessions, transcript, jobs)
           │
           │  RPC / daemon / MCP
           ▼
Prime Agent (engine)
  • RLM, workers, tools, long-run control
           │
           ▼
Markdown vault on disk  ← single source of truth
```

**Rules of the architecture**

1. **Vault wins** — durable knowledge is notes/files humans can open and fix.  
2. **Prime runs** — hard agent loops, subagents, long jobs live in [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent).  
3. **Rhizome presents** — desktop UI, research/memory ops, session chrome.  
4. **Refine → notes** — harness “memory” should materialize into the vault over time, not stay forever only under `~/.prime`.  
5. **Hermes** = “this should feel as capable as a serious agent product,” not “fork Hermes.”  
6. **Selective borrowing** — absorb contracts and artifacts from other harnesses; never transplant their control loops (ADR-0168).

## What this is *not*

- Not “fork [OpenCode](https://github.com/anomalyco/opencode) and become another coding agent”  
- Not “throw away PKM and ship a terminal with an icon”  
- Not “rebuild Prime inside Rhizome”  
- Not “use Hermes as the primary engine” (unless later as *one* optional backend; the preferred RL stack is Prime)

## Why this is better than starting from OpenCode

OpenCode already *is* a coding-agent product (TUI + [desktop](https://opencode.ai/download)). If Prime owns the agent runtime, OpenCode’s core overlaps and fights for control. You still lack a vault-native memory OS.

Rhizome already has desktop + memory + research + agent shell hooks. With Prime as the brain, Rhizome is the **missing product layer**, not a redundant agent core.

## Success looks like

A user opens **Rhizome**, works in their **vault**, runs **long agent work** powered by **[Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent)**, and every important outcome lands as **inspectable knowledge**—research pages, entities, decisions, procedures—not only a chat log.

**Positioning:** *the local-first memory OS and desktop harness for long-running agents*—not “yet another coding TUI.”

## Phased direction (design only until implemented)

| Phase | Focus |
|-------|--------|
| **v0** | Prime session in vault cwd; chat/transcript in Rhizome via [RPC](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/rpc.md) |
| **v1** | Jobs, attach/detach, session list ([daemon](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/daemon.md)-aware UX) |
| **v2** | Research/Distill as first-class memory ops; refine/harness updates → vault notes |

## Key external links (bookmark list)

- Prime Agent: https://github.com/PrimeIntellect-ai/prime-agent  
- Install: `curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh \| sh`  
- Prime Agent blog: https://www.primeintellect.ai/blog/prime-agent  
- RLM: https://www.primeintellect.ai/blog/rlm  
- Continual harness paper: https://arxiv.org/abs/2605.09998  
- Prime Intellect: https://www.primeintellect.ai/  
- pi (upstream TUI base): https://github.com/earendil-works/pi  
- Hermes Agent: https://hermes-agent.nousresearch.com/  
- OpenCode: https://opencode.ai/ · https://github.com/anomalyco/opencode  
- Rhizome Agent: https://github.com/tuckcode/rhizome-agent  
