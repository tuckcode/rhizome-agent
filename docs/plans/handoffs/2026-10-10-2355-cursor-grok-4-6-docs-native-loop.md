---
session: 2026-10-10T19:01Z
model: Cursor Grok 4.6
description: >-
  Living docs now match the native loop after 1a–1c: create_note is a
  loop tool, stream_model_events is gone, RoutingModel reports provider
  attempts. Chat still uses Prime. No product code.
commits: 009e153..HEAD
---

**Origin:** Cursor Grok 4.6 · 2026-10-10 · weekly docs automation

## What changed

Docs only. Verified against `rhizome_loop/`, `rhizome_routing/`,
`engines/`, `ai_model_tools.rs`, and `ai_models.rs` on `main` at
`009e153`.

- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) § Rhizome-owned loop —
  modules, tool policy, `create_note` constraints, stream/routing,
  how to test.
- [`YOU-SHOULD-KNOW.md`](../../YOU-SHOULD-KNOW.md) — Rhizome owns the
  loop; Chat still uses Prime.
- [`GETTING-STARTED.md`](../../GETTING-STARTED.md) — pitfalls for the
  deleted stream wrappers, loop `bash`, blocking HTTP, OmniRoute lock.
- [`CROSS-MODEL-HANDOFF.md`](../../CROSS-MODEL-HANDOFF.md) §26 —
  same traps.
- Remaining-threads plan ground truth and 1a–1c marked done.

## Still true

Chat commands do not call the loop. 2a is next. 2c waits for knispo.
`leftover-prime-keep.test.ts` and `leftover-omniroute-parked.test.ts`
stay as phrase locks.
