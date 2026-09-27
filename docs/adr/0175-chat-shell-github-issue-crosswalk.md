---
type: ADR
id: "0175"
title: "Chat-centered shell: GitHub issue crosswalk"
status: active
date: 2026-09-27
---

**Origin:** Composer 2.5 Fast · 2026-09-27 · Cursor swarm Wave 1 (D-6)

## Context

[NEXT.md](../NEXT.md) §4 noted that no ADR linked GitHub issue numbers, so agents
could read [ADR-0166](0166-chat-centered-shell.md) without knowing which issues
it satisfied or blocked.

ADR-0166 left Graph and Mycelium on the **canvas** as an open question for
#39, #11, and #22. [ADR-0170](0170-notes-heavy-right-panel.md) and
[ADR-0171](0171-graph-on-changes-only.md) later settled **UI placement** without
replacing ADR-0166's text (repo rule: supersede with a new ADR, do not edit
in place).

## Decision

**This ADR is the bidirectional index between the chat-centered shell ADR chain
and the GitHub issues that motivated it.** It does not change layout.

| Issue | State (2026-09-27) | Shell ADR | Notes |
|---|---|---|---|
| [#27](https://github.com/tuckcode/rhizome-agent/issues/27) — session list as dockable sidebar | Closed | ADR-0166 | Sessions column left of Chat; not a full-surface destination. |
| [#34](https://github.com/tuckcode/rhizome-agent/issues/34) — search/filter session list | Closed | ADR-0166 | Shipped with session-list UX in the chat-centered shell. |
| [#11](https://github.com/tuckcode/rhizome-agent/issues/11) — Mycelium in-app | Closed | ADR-0170, ADR-0171 | Sidecar embed; not a separate app launch. |
| [#22](https://github.com/tuckcode/rhizome-agent/issues/22) — Mycelium chrome / entry points | Closed | ADR-0170 | Rhizome skin + session footprint affordances. |
| [#39](https://github.com/tuckcode/rhizome-agent/issues/39) — graph as agent tool | Open | ADR-0166 (product thesis), ADR-0171 (where Graph appears in UI) | Scoped MCP graph tools shipped; issue tracks composition/UI leftovers — see [issue-39 findings](../plans/handoffs/2026-09-14-1613-issue-39-findings.md). Not the same as "Graph on canvas vs panel." |

**ADR-0166 open question (Graph/Mycelium canvas vs side):** Closed for product
UI by ADR-0170 (notes-heavy right column, no Connections edge strip) and
ADR-0171 (Graph/Mycelium mount only on the Changes filter). Agents should read
0166 → 0170 → 0171 → this file before inferring layout from issue titles alone.

## Consequences

* Issue comments and handoffs can cite this ADR instead of restating region maps.
* #39 remains open until GitHub is closed there; agent-tool work is not blocked
  on shell ADR edits.
* Future shell changes that affect these issues need a new superseding ADR, not
  edits to ADR-0166.

[[0166-chat-centered-shell]]
