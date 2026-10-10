# Step 6a — Anthropic streaming on the native engine

**Origin:** ChatGPT draft · 2026-10-10 · approved by knispo
**Status:** plan only. This file writes no product code. knispo merges the
implementation PR.
**Parent:** [`2026-10-10-harness-remaining-threads.md`](2026-10-10-harness-remaining-threads.md)
D4 and D12.

This work follows launch. Step 6 first moves callers that use the OpenAI
request format. Keep the old Anthropic call until step 6a passes.

## Steps

1. Add Anthropic streaming, which delivers replies in pieces, to the
   native engine.
2. Translate text, tool requests, usage totals, completion reasons, and
   errors into the engine's shared events. Assemble complete tool
   arguments before execution.
3. Connect cancellation, saved history, and approval handling. Preserve
   Anthropic's conversation format across tool results.
4. Test the native path against the old path. Switch Anthropic after the
   checks pass, then delete the old call.

## Tests

Test text split across chunks, multiple tool requests, partial tool
arguments, tool results, and normal completion.

Test cancellation, connection loss, service limits, malformed events,
and restart recovery. Verify that partial requests never execute and
tools never execute twice.

Test that restored chats require fresh permissions and saved records
exclude known credentials. Run one live text exchange and one approved
tool exchange before switching.

## Risks

The providers represent tools and completion differently. Incorrect
translation could lose content or execute a tool too early.

Retries after a connection failure could repeat actions. Preserve
partial text, report the interruption, and require an explicit new
attempt.

Deleting the old call removes the immediate fallback. Keep it until
native behavior passes the agreed checks.
