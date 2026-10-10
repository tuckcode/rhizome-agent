---
type: ADR
id: "0178"
title: "Generic ACP client; Hermes one-shot is fallback"
status: active
date: 2026-10-05
---

**Origin:** Cursor Grok 4.6 · 2026-10-05 · implements ADR-0177 consequence 1

**Amended 2026-10-09:** ADR-0177's client identity is superseded by
[ADR-0180](0180-rhizome-is-its-own-harness.md). This ADR still holds as
the optional Hermes / ACP engine path.

## Context

[ADR-0177](0177-rhizome-is-a-client-of-harnesses.md) decided that Rhizome is a
client of harnesses and does not own the agent loop. Hermes still ran as
`hermes chat --quiet --source tool -q <prompt>`: one-shot stdout, no session,
no permission or edit-approval bridge, no resume. That path makes Rhizome the
harness for the turn.

Hermes already ships an ACP adapter (`hermes acp`, JSON-RPC over stdio). The
Agent Client Protocol is the same contract a later harness (deepseek-harness
or otherwise) would speak. Prime stays on its own daemon protocol
([ADR-0163](0163-connect-to-the-prime-daemon.md)); this ADR does not replace
that host.

## Decision

**Rhizome speaks ACP as a generic stdio JSON-RPC client. Hermes is the first
adapter. The old `hermes chat` path stays as automatic fallback until ACP is
proven on a real Hermes install.**

- The client lives in `src-tauri/src/acp_client/` and is not Hermes-named.
  A later ACP harness is a launch command plus adapter glue, not a second
  protocol stack.
- The public dispatch remains `ai_agents::run_ai_agent_stream` →
  `hermes_cli::run_agent_stream`, the same seam Prime and the other CLI
  adapters already use.
- Rhizome owns persona (system prompt on the first turn), permission and
  edit-approval *policy* (Limited tools / Power User from ADR-0103), and the
  Markdown transcript. The harness owns the loop, tools, routing, and session
  runtime.
- Permission requests (`session/request_permission`) are answered from that
  policy: Limited tools selects a reject option; Power User selects allow-once
  (or Hermes `allow_once`). Power User also asks Hermes for session mode
  `accept_edits`. There is no new per-request card in this slice — the
  existing toggle is the policy, and the decision is shown as a tool event.
- Session restore prefers `session/load` when advertised. Hermes
  `session/resume` mints a new session when the id is missing and still
  returns success, so a later prompt on the remembered id fails. Resume is
  used only when load is not advertised. Replay during load is swallowed
  so Rhizome's own transcript is not duplicated. A failed restore keeps
  the full composed prompt (persona + history) on `session/new`.
- Do not fork or vendor Hermes code. Do not add the official
  `agent-client-protocol` crate for this surface: the methods we speak are
  small, and a new dependency is not justified.

## Options considered

* **Option A (chosen): generic ACP client + Hermes adapter + chat fallback.**
  Matches ADR-0177. Downside: two Hermes transports until ACP is proven.
* **Option B: official Rust ACP SDK.** Stronger type coverage. Rejected for
  now: new dependency, larger than the methods we need, and the spec is
  still moving (v2 draft). Revisit if the client grows past initialize /
  session / prompt / permission.
* **Option C: replace Hermes chat only, keep the client Hermes-specific.**
  Rejected. The next ACP harness would copy the stack.
* **Option D: drop the one-shot path immediately.** Rejected. Installed
  Hermes may lack the ACP extra; silent failure is worse than a documented
  fallback.

## Consequences

- `hermes acp --check` succeeding is what selects ACP. Failure, a missing
  binary, or an old Hermes keeps `hermes chat --quiet --source tool`.
- Rhizome does not advertise client fs/terminal capabilities. Hermes uses
  its own tools and asks permission over ACP.
- Live per-request approval UI is still future work. Policy is the existing
  Limited tools / Power User toggle.
- Provenance stays in Rhizome's vault layer; this ADR does not import Hermes
  `provenance.py`.
- Real-Hermes dogfood is required on a machine that has `hermes acp` before
  the fallback can be retired.

[[0177-rhizome-is-a-client-of-harnesses]]
[[0163-connect-to-the-prime-daemon]]
[[0103-adapter-specific-ai-permission-semantics]]
