---
session: 2026-10-17T02:45Z
model: Cursor Grok 4.6
description: >-
  Remove the Packages marketplace and the pi agent. Saved pi and gemini
  default_ai_agent values migrate to prime.
---

# Remove pi and Packages

**Origin:** Cursor Grok 4.6 · 2026-10-17 · this session

Rhizome no longer ships a Packages catalog or a `pi` agent.

- Settings → AI Agents → Advanced Prime engine keeps Prime install status and Copy MCP config. The Extensions/Skills catalog is gone.
- Tauri `list_prime_packages` / `install_prime_package` and the `prime_packages` / `pi_*` adapters are gone.
- Settings normalization loads an old `default_ai_agent: "pi"` or `"gemini"` as `prime`.
- `src-tauri/src/rhizome_loop/tools.rs` was not touched.

Review shots: `docs/review-shots/remove-pi/`.
