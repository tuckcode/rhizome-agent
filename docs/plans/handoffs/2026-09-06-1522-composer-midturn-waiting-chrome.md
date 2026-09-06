---
session: 2026-09-06T15:22:00-05:00
model: Composer
description: >-
  Daily-drive: #41 mid-turn queue chrome confirmed live — “Waiting in this
  session” with MIDTURN_QUEUE_PROBE while Working on rhizome-vault graph tools
  (DeepSeek V4 Flash · Rhizome Vault); session log shows queue + assistant ack.
---

# Mid-turn “Waiting in this session”

**Origin:** Composer · 2026-09-06 · daily-drive goal

## Evidence

Atticus C&P dogfood (automation cannot reliably press Enter in WKWebView):

1. First message ran `rhizome_graph_health` → orphans → dead_links on
   Rhizome Vault via DeepSeek V4 Flash.
2. Second message while Working: `MIDTURN_QUEUE_PROBE…`
3. UI showed **Waiting in this session** with that text and a Clear control;
   status stayed `Working · last tool …`.
4. Prime session `01a0785f-…` contains the queued user message and a later
   assistant acknowledgment.

## Product note

Default AI target should stay on **Prime Agent**. Model choice is the Chat
model pill (DeepSeek here), not Settings → API model (that path skips Prime
tools). Anthropic/xAI OAuth still expired; DeepSeek API key is the reliable
daily model until Terminal reconnect.

## Still open for the goal

C57 Limited tools answers · session-import UI · OAuth reconnect · uncommitted
tree (providers UI, Settings copy, C69 bundle, graph Find, chat select).
