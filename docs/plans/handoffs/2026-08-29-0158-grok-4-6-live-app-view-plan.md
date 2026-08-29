---
session: 2026-08-29T01:58-05:00
model: Grok 4.6 (Cursor)
description: >-
  Plan only for GitHub #50: let the agent see the running app. Recommends
  pnpm live-ui against the browser build, read-only plus test-bridge steer,
  developer tooling not an in-app pane. Awaiting Atticus approval. No product
  code.
commits: 821e8e5
---

# #50 live-app-view plan — 2026-08-29

**Origin:** Grok 4.6 (Cursor) · 2026-08-29

Filed from the session-naming handoff. This session did not build the
feature. It answered the three questions in #50 and wrote

[`docs/plans/2026-08-29-live-app-view-plan.md`](../2026-08-29-live-app-view-plan.md).

## Answers proposed

1. **Which app:** `pnpm dev` (the browser build). Layout bugs show there.
   Native stays out until permissions are not the point of the work.
2. **Read or drive:** read-only dump, plus *steer* through
   `window.__rhizomeTest` (already used by smoke tests). No pixel click/type.
3. **Where it lives:** `pnpm live-ui`, beside `pnpm deadcode`. Not a rail
   destination. MCP wrap is slice 2. A Mycelium-style iframe of the app
   inside the app is deferred.

The dump must include scroll metrics for named wells. `uiAudit`'s four
rules would not have caught the three-day missing transcript scroller.

## Not done

Waiting on Atticus to approve or change those three answers. Then build
the file-touch list in the plan — scripts and a snapshot helper only.

## Stranded in the working tree (not this session)

Uncommitted when this plan was written, and **left uncommitted** (this
commit is docs only):

- `src/lib/aiAgentPermissionMode.ts` (+ tests) — Prime always power user;
  Vault Safe relabelled “Limited tools”
- `src/utils/ai-agent.ts` (+ tests) — Prime prompt no longer forbids shell
- `src/components/AiPanel.test.tsx` — matches the above
- `src-tauri/src/prime_session_host.rs` — C55 catalog fallback when
  `get_state` omits `input`

That looks like the Vault Safe decision being implemented in parallel.
Do not mix it into a #50 docs commit.
