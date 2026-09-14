# W4 — Chat reliability

**Owner:** Cursor Grok 4.6 (W4 Chat reliability, source only).
**State:** ready to integrate (source remainder). Native cases still **NOT RUN**.
**Start:** evidence now. W7 releases shared Rust paths before W4 edits them.
Follow the [parent contract](README.md) and the God plan's acceptance matrix.

Read [hide helpers](../../hide-on-close-helpers.md), `src/hooks/C64.md`, and the #41 send-policy evidence.
The helper stop and `AiPanel.onSteer` already exist. Start with the remaining behavior, not an implementation assumption.

1. Prepare isolated Chat and vault probes without displacing a user session.
2. Check send/reconnect/failure, steer/queue admission, and message preservation.
3. Record native startup and hide/reopen evidence when the app is safely available.
4. Fix only a reproduced defect through a focused regression test.
5. Return exact build evidence and unresolved native checks to W1.

Apply the God plan's daily-driver gate. Include session selection, usable model/Settings controls, note save/reopen, and observed responsiveness.
Record actual timings or observations. A reproduced freeze blocks the candidate. Missing native evidence stays explicit.

**Done:** every selected acceptance case has a truthful result. Any code fix passes the relevant gates.
**Stop:** no safe native session, uncertain helper ownership, or an occupied shared path.
Continue independent checks. Never mass-kill helpers. A test of helper names cannot pass a process-lifecycle check.

---

## Fill record

```text
Owner: Cursor Grok 4.6 — W4 Chat reliability (source only)
State: ready to integrate (source). Native blocked on Atticus slot.
Starting revision: 4416411 (local HEAD). origin/main still 5c629a0.
Owned paths:
  docs/plans/handoffs/2026-09-14-1120-cursor-grok-4-6-w4-source-remainder.md
  docs/plans/handoffs/2026-09-13-2235-cursor-grok-4-6-w4-reliability-evidence.md (morning append)
  docs/plans/s-plans/2026-09-13-astra/W4-chat-reliability.md
Sibling overlap and release condition:
  Did not edit lib.rs, prime_session_host.rs, mcp.rs, prime_vault_skill.rs,
  vault_list.rs, commands/mod.rs, or MCP JS. Native C64/hide/send are
  Atticus-only this morning. Did not launch or quit Rhizome.
One bounded change or evidence task:
  Reconfirm #41 onSteer wiring + leftover file:line; rerun focused unit tests.
Acceptance cases:
  C64 startup — NOT RUN (C64.md launch 1 not watched; 2–3 empty)
  Send and recover — NOT RUN
  Steer / queue — NOT RUN natively; source wired (see leftover table)
  Hide / reopen — NOT RUN
  Memory path — NOT RUN
Evidence: npx vitest run (8 files) → 98 passed / 98; HEAD 4416411;
  evidence path: docs/plans/handoffs/2026-09-14-1120-cursor-grok-4-6-w4-source-remainder.md
Commit: none
Pushed: no
Installed build tested: no — still 476756c
Unverified behavior: all five God-plan native cases; useful mid-turn error banner
Blocker and next action: Atticus native slot on /Applications 476756c —
  C64 ×3, hide/reopen with helper ps, one live steer + Enter-queue glance.
  Do not close #41. Do not call daily-driver ready.
Later same day: C64.md restamped still NOT RUN (1342, 14:35). Do not launch.
Later same day 14:36: five native cases still NOT RUN. Do not close #41.
Later same day 15:27: five native cases still **NOT RUN**. App still
`476756c`. Do not launch. D6 commits do not close W4.
```

## Integration payload (for W1)

- **Behavior verified (source only):** `#41` `onSteer` is wired at `src/components/AiPanel.tsx:544`. Enter mid-turn is follow-up, not steer. Queue chrome + Clear-all exist. `mutate_queued_message` is still unspoken (catalog `docs/prime-adapter-surface.json:74`; named leftover `docs/design/prime-spoken-surface.md:33` and `:61`). No TS call site. No Rust host wrapper.
- **Revision:** source checks against local `4416411`. Packaged app still **`476756c`**.
- **Evidence:** unit **98/98** on the eight send/queue/C64 files. All five God-plan native cases **NOT RUN**.
- **Remaining:** Atticus native C64 ×3, hide/reopen, live send/reconnect/steer. Mid-turn transport `failed` keeps the draft and does not set a Chat error banner — do not treat that as the God-plan useful-error pass. Do not close #41. Not daily-driver ready.
- **Same-day source neighbor (1216):** Codex + typed text stays Stop-only. Native still **NOT RUN**.
