# W4 — Chat reliability

**Owner:** current Cursor Prime/Chat owner, Grok.
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
