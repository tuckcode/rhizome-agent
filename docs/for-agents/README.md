# Agent instructions

Hand this repo to an agent with the block below. The full rules for an agent that edits this tree are in [AGENTS.md](../../AGENTS.md).

## Paste this

```text
This is Rhizome, repo tuckcode/rhizome-agent, bundle id ai.rhizome.agent.
It is not Rhizome Desktop. Do not add knispo/rhizome as a remote.
Read AGENTS.md before you change code. English only.
The vault is plain Markdown on disk. You and the person can both read it.
Rhizome runs its own agent loop, and it is the only chat engine (ADR-0187). Prime and Hermes are removed from the app ([ADR-0189](../adr/0189-no-ties-to-outside-harnesses.md)); do not add code that depends on them.
The native engine can read, search, edit, and write vault files, run commands with approval, and create notes.
It cannot search past chat sessions yet.
```

## One line

```text
Rhizome (tuckcode/rhizome-agent, ai.rhizome.agent) is not Rhizome Desktop. Read AGENTS.md first. English only. The vault is plain Markdown on disk. Rhizome's own engine is the only chat engine; Prime and Hermes are removed (ADR-0189).
```
