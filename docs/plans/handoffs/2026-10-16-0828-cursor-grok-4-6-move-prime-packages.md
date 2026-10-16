---
session: 2026-10-16-0828
model: Cursor Grok 4.6
description: Move Prime Packages from the Settings nav into collapsed Advanced Prime engine.
---

# Move Prime Packages under Advanced Prime engine

**Origin:** Cursor Grok 4.6 · 2026-10-16 · this session

Packages stays in the product. It is no longer a top-level Settings page.

- Settings nav no longer lists Packages.
- `PrimeExtensionsSection` renders inside a collapsed **Advanced Prime engine** disclosure on Settings → AI Agents, next to Copy MCP config.
- Old section ids `packages`, `settings-section-extensions`, and `settings-section-packages` open that disclosure.
- `primePackages.ts`, Tauri package commands, and the Packages tests stay. NativeChatModelPicker was not touched.
