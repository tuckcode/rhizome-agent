---
session: 2026-10-24-1558
model: Cursor Grok 4.7
description: Connected provider summary, interactive agent cards, picker disabled rows
---

**Origin:** Cursor Grok 4.7 · 2026-10-24 · provider settings and model picker

## What changed

Settings AI Agents opens with a Connected list. Each local agent card can copy MCP config when installed, or open install docs and re-detect when missing. Rhizome does not offer Use in chat for those CLIs (ADR-0189).

The composer picker keeps providers that are not set up as disabled rows. A live model list that does not finish within 10 seconds says Couldn't load models, with Retry.

Prime provider status, Prime default model, and the Prime model allow-list are removed from Settings. The Rust merge for Nous models is unchanged.

## m

The row `m` under Scrub test is the saved model id on that custom provider. `normalizeListedProviderModels` does not split a string body into letters. The hang was the missing client timeout.
