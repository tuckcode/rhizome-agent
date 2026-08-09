# How comparable tools trigger and persist agent memories — 2026-08-02

Answers leg (b) of the user's 2026-07-19 question — *"is there even a
reliable trigger/save method for memories/wiki"* — which asked to research
comparable tools **before** designing our own. Leg (c), the audit of our own
write path, was done first (`2026-07-31-save-path-audit-session-status.md`,
all 10 findings closed 2026-08-02) because it was already in flight when this
was scoped. This document is leg (b), done after the fact, and leg (a)
(blank-vault native test) is still outstanding — it needs a human at
`pnpm tauri dev`.

Method: targeted web research across the tools our own prior sessions had
already surfaced as comparable (`mem0`, `Letta`/MemGPT, ChatGPT memory,
Claude Code memory) plus two structurally adjacent categories — local-first
PKM auto-capture (Obsidian) and agent-memory reliability research. Not
exhaustive; picked for genuine architectural difference, not coverage.

## The short version

Every tool in this space picks a point on one axis: **who decides a save
happens** — the system (silent, automatic), the model (a tool call the LLM
chooses to make), or the user (explicit command). Nobody has solved
"automatic and trustworthy" — the two tools that lean hardest into automatic
(ChatGPT, Mem0) are also the ones with the least legible failure mode when it
misfires. Rhizome's actual problem, per the audit, was never "which point on
that axis" — it already supports all three (agent-driven capture, MCP tool
calls, hand-edit) via six entry points. The audit's verdict was narrower and
worse: **the metadata describing which mechanism fired was written and
never read**, so even a correctly-firing trigger left no trace a user could
audit. That specific failure — a trigger silently going nowhere — turns out
to be the one common failure mode named explicitly in the literature, and it
maps almost exactly onto one existing tool's own published caveat.

## Four trigger philosophies, in the wild

### 1. Fully automatic, system-decided — Mem0 / OpenMemory, ChatGPT memory

Mem0 extracts structured facts from a conversation in the background —
semantic, not literal: "let's go with Postgres" becomes "project uses
Postgres as primary database," stored without the user tagging or asking.
OpenMemory (Mem0's cross-client layer) does the same over chat prompts,
watching for facts like "lives in New York" and saving them unprompted.
ChatGPT's memory works the same way, and it's been measured, not just
described: **an arXiv study analyzing 2,050 real memory entries from 80 users
found 96% were unilaterally initiated by ChatGPT itself — only 4% followed an
explicit "remember this" from the user** — with a documented gap between
OpenAI's stated policy (user-involved) and what the system actually does
(system-decided by default).

**Trade-off:** maximum capture, minimum friction, and the least legible
failure mode of any philosophy here — because nothing about the interaction
signals when it *doesn't* fire. If the extraction pass misses something, there
is no negative event to notice.

### 2. Model-decided via explicit tool call — Letta / MemGPT

Letta's agents don't have a background extraction pass; they *reason* about
whether something is worth keeping and, if so, call a memory tool
(`core_memory_append`, `core_memory_replace`) mid-conversation. Three
tiers — Core (pinned in context, like RAM), Recall (searchable history, like
a disk cache), Archival (long-term, agent-queried via tool call, like cold
storage) — map an OS memory hierarchy onto what's worth different retrieval
cost. The trigger is real, not metadata-only: a memory only exists because
the agent's own reasoning chose to call the tool, and that tool call is a
first-class, inspectable event in the transcript.

**Trade-off:** the trigger is legible (it's a tool call you can see happen or
not happen) but *conditional on the model choosing to notice* — there's no
guarantee the agent recognizes a fact as save-worthy in the moment. This is
structurally the closest of the four to Rhizome's own MCP save path (an agent
choosing to call `rhizome_append_event` mid-conversation) — but Letta's tool
call itself *is* the record, where Rhizome's trigger field was, until this
session, a record nothing consumed.

### 3. Explicit user command, system stays passive — Claude Code

Claude Code's primary memory surface, `CLAUDE.md`, isn't a trigger system at
all — it's a file read once per session start. The actual save mechanism —
project or global memory files under `~/.claude/.../memory/`, indexed by
`MEMORY.md` — is explicitly *not* automatic: "you have to tell it explicitly
what's worth keeping, or ask it to run the audit itself." A dedicated
"Remember" skill exists specifically to give this an anchored, deliberate
entry point rather than letting it happen implicitly mid-conversation.

**Trade-off:** the most legible of the four — nothing is saved without a
visible command — at the cost of coverage. Anything the user doesn't think
to say "remember this" about doesn't get captured. This is the philosophy
Rhizome's **hand-edit** and **Research panel** entry points already match
(`"manual"` trigger, hardcoded).

### 4. Deterministic file-creation hook, silently bypassable — Obsidian (Templater)

The one directly structural analog to Rhizome's actual bug. Obsidian's
Templater plugin can auto-apply a template — effectively "run this capture
logic" — on new file creation, mapped by folder. It's deterministic and
config-driven, the opposite of the other three's inference-based approaches.
But Obsidian's own documentation carries this caveat verbatim: **"if you
create a daily note by typing a new file manually instead of using the Daily
notes/Calendar flow, the template won't apply."** The trigger only fires if
the file was created through the blessed path; any entry point that
creates the file another way silently skips it, with no error and no signal
that anything was skipped.

That sentence is close to a description of Rhizome's own finding 4: *"six
event types can never carry a trigger"* — entry points that write a note but
bypass the code path that would tag *how*. Same shape of bug, different
product.

## What this validates and what it doesn't

**Validates the direction, not just the existence, of finding 1's fix.**
None of the four philosophies leaves the trigger as *write-only metadata*.
Automatic tools (1) don't have a separate trigger field to begin with — the
extraction event and the memory *are* the same thing. Tool-call tools (2)
make the trigger the primary observable event. Explicit tools (3) make the
trigger the entire interaction. Even the deterministic-but-bypassable tool
(4) treats the *template application* as the meaningful unit, not a field
describing it after the fact. A trigger nobody reads back — Rhizome's
pre-2026-08-02 state — isn't a lesser version of any of these four; it's a
distinct failure mode none of them have, because in all four, "trigger" and
"the thing that happened" are either the same event or directly coupled.
`sourceFor()` reading `trigger` back into the activity feed (closed this
session) is what closes that gap — not a partial version of any competitor's
design, a fix to a bug none of them have.

**Validates auditability as the active industry answer, not a Rhizome-only
concern.** The reliability-research sweep converged on the same two
findings repeatedly: agent-memory silent failure is described as "among the
most common points of silent failure in production agent systems," and the
fix the field reaches for is an audit trail — one production tool (Muninn) is
built specifically to make memory retrieval "deterministic, explainable,"
so a user can trace "whether retrieval was accurate." Rhizome's finding 8
(one malformed `events.jsonl` line blanks the whole 200-event feed) and
finding 7 (three sites swallowed log failures with no warning, closed this
session) are exactly this category of bug, in the exact category the
literature says causes the most damage per incident, because it never
overtly fails.

**Does not validate picking a single philosophy.** Rhizome's six entry
points already span all three "who decides" answers — agent-driven (2),
MCP/menu-bar (something like 1, minus the inference), hand-edit (3) — and
nothing in this research suggests collapsing that range would help. The
audit never found "wrong trigger philosophy" as a problem; it found "trigger
recorded, never consumed" and "swallowed failures," both fixed by making the
existing design's plumbing complete rather than by adopting someone else's
model.

## Open, not settled by this research

- **Leg (a) is still outstanding** — none of this substitutes for actually
  running the save loop against a blank vault. The literature explains *why*
  memory tools fail silently in general; it doesn't tell you whether
  Rhizome's does, right now, on a fresh vault. That's still a native-QA item.
- **Rate limiting / de-dup on automatic capture** wasn't explored here and
  is the philosophy-1 tools' hardest unsolved problem (the ChatGPT study's
  52%-psychological-inference figure is arguably over-capture, not
  under-capture) — worth a dedicated look only if Rhizome ever adds inference
  on top of its existing explicit/agent-driven paths, which it hasn't.
- **`events.jsonl` has no rotation and the reader caps at 200 lines**
  (carried over from the audit, restated in HANDOFF 2026-08-02) — orthogonal
  to trigger design but adjacent enough that a future audit of this area
  should treat it as one item, not rediscover it.

## Sources

- [OpenMemory MCP overview — automatic fact extraction](https://mem0.ai/openmemory)
- [Introducing OpenMemory MCP](https://mem0.ai/blog/introducing-openmemory-mcp)
- [Introducing the OpenMemory Chrome Extension](https://mem0.ai/blog/introducing-the-openmemory-chrome-extension)
- [Agent Memory: How to Build Agents That Learn and Remember — Letta](https://www.letta.com/blog/agent-memory/)
- [Stateful AI Agents: A Deep Dive into Letta (MemGPT) Memory Models](https://medium.com/@piyush.jhamb4u/stateful-ai-agents-a-deep-dive-into-letta-memgpt-memory-models-a2ffc01a7ea1)
- [The Algorithmic Self-Portrait: Deconstructing Memory in ChatGPT (arXiv 2602.01450)](https://arxiv.org/abs/2602.01450)
- [Memory FAQ — OpenAI Help Center](https://help.openai.com/en/articles/8590148-memory-faq)
- [How Claude remembers your project — Claude Code Docs](https://code.claude.com/docs/en/memory)
- [Persistent memory in Claude Code: what's worth keeping](https://dev.to/ohugonnot/persistent-memory-in-claude-code-whats-worth-keeping-54ck)
- [Obsidian Templater Plugin Guide — trigger-on-creation and its manual-file-creation caveat](https://www.obsibrain.com/blog/obsidian-templater-plugin-guide)
- [The Benchmark That Exposed a Silent Failure in AI Agent Memory](https://medium.com/data-science-collective/the-benchmark-that-exposed-a-silent-failure-in-ai-agent-memory-668273525c3b)
- [In-Process Retrieval Memory Agents: A Production Playbook (Muninn, audit trails)](https://sivaro.in/articles/in-process-retrieval-memory-agents-a-production-playbook/)
