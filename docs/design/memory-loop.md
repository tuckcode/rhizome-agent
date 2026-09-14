# Memory loop

**Status:** the product thesis. Pieces exist; this is the missing index.  
**Origin:** `CONTEXT.md` + NEXT.md §4 item 3 + HANDOFF 2026-07-19 question.  
**Not:** a new memory engine. Prime session files stay operational. Vault stays durable.

---

## Done / now / next

- **Done:** write path audited (2026-08-02). Promote (#24) closed. Retrieval provenance (#25) closed. Vault `Imports/` writer shipped (Claude Code). Distill exists. `trigger` has a reader.
- **Now:** the loop is still not one picture an agent can execute. Blank-wiki save-loop test **(a)** is still open.
- **Next:** keep promote/search honest; finish session-list import; do not auto-wiki.

**Done when:** chat → work → promote → recall is named in one place, each hop has an owner, and a blank vault can be tested by a human.

---

## The loop (world → program)

```
Chat with Prime
  → agent works (tools, vault MCP when attached)
  → promote durable bits into vault markdown
  → next Session searches / opens those notes
```

| Hop | Owner | Must not become |
|---|---|---|
| Execution | Prime | Rhizome loop |
| Durable note | Vault | `~/.prime/agent` as the wiki |
| Harness ledger | Prime refine / RLM harness | silent dual-write into the vault |
| Promote | explicit tool and/or UI | auto-wiki from every turn |

`IDENTITY.md`: if Prime has a mechanism, use Prime’s **design** (refine, versioning). Durable knowledge still lands in the vault.

---

## What already exists

| Piece | Where | State |
|---|---|---|
| Save / distill / menu-bar / MCP / CLI / hand-edit | six writers; audit closed 2026-08-02 | write path reliable; triggers were the old bug |
| Promote | #24 closed 2026-08-28 | do not reopen as “no promote” |
| Retrieval provenance | #25 closed 2026-09-04 | `From your vault` + unwrap of Prime `get_note` shapes |
| Events log | `.rhizome/events.jsonl` | grows unbounded; reader caps at 200 |
| Consolidation L0→L3 | [`automatic-memory-consolidation.md`](automatic-memory-consolidation.md) | specced, not built; not an ADR |
| Session import | [`../plans/2026-09-01-session-import-plan.md`](../plans/2026-09-01-session-import-plan.md) | vault half shipped; Prime list rows blocked |
| Vault skill home | [`vault-skill-home.md`](vault-skill-home.md) | parked |

---

## Still open (do not invent answers)

1. **HANDOFF (a):** blank / fresh vault, full save loop, human at `pnpm tauri:dev`. Investigation, not a code spike.
2. **One write authority** for memory (composition item 4): Hermes approval vs vault promote vs Prime refine ledger.
3. **Automatic consolidation** hard part: Distill today needs an agent call. Background-safe invoke without a live Chat is unspecified. Leave it in `automatic-memory-consolidation.md`.
4. **C66** agent profile (how the agent should respond) is **not** this loop. Not vault `AGENTS.md`, not Prime `USER.md`. [`../HANDOFF.md`](../HANDOFF.md) C66.

---

## Session import (onboarding half of the same thesis)

Always a Prime session-list row (intent). Also a vault note under `Imports/` when a vault is open.

Vault writer: shipped. List rows: not. Blocker: Prime `import_jsonl` **replaces the active session**. Routes: [`../plans/handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md`](../plans/handoffs/2026-09-06-2152-composer-prime-session-list-import-brief.md).

Do not treat vault-only import as “import done.”

---

## Agent steps (when claimed)

1. Read this file + `CONTEXT.md` Memory + the hop’s issue/ADR.
2. If the claim is about Prime or macOS, verify live. Repo notes are not primary sources.
3. Prefer promote over new writers. Reuse `ArtifactKind` / distill paths.
4. Completion: HANDOFF says which hop moved; BOARD pile updated; no second store.
