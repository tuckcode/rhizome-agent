---
type: ADR
id: "0029"
title: "Domain command builder pattern for useCommandRegistry"
status: active
date: 2026-03-30
---

## Context

`useCommandRegistry` was a 224-line "brain method" (CodeScene hotspot) that defined all command palette commands inline: navigation, note actions, git operations, view toggles, settings, type management, and filter controls. This monolithic structure scored 39 on CodeScene's complexity scale (target: ≤9.5 for hotspots), making it increasingly hard to add new commands without touching the central file.

## Decision

**Split command definitions into focused domain modules under `src/hooks/commands/`, each exporting a `build*Commands(config)` factory function. `useCommandRegistry` becomes a thin assembler that calls each builder and merges the results.** Domain modules: `navigationCommands`, `noteCommands`, `gitCommands`, `viewCommands`, `settingsCommands`, `typeCommands`, `filterCommands`. Shared types live in `commands/types.ts`; public API re-exported from `commands/index.ts`.

## Options considered

- **Option A** (chosen): Domain builder modules — each module owns its command shape and receives typed config. `useCommandRegistry` is pure assembly. All new files score 9.58–10.0. Downside: more files to navigate.
- **Option B**: Split by file but keep one large hook calling sub-hooks — sub-hooks still need shared state passed down, similar coupling. No real complexity win.
- **Option C**: Register commands imperatively via a global registry — decouples callers entirely. Downside: harder to trace, no TypeScript inference at the registration site, over-engineering for current scale.

## Consequences

- Adding a new command means editing the relevant domain module (e.g. `noteCommands.ts`) only, not touching the assembler.
- Each domain module receives only the config it needs — explicit, typed interface, no hook dependency.
- `useCommandRegistry` reduced from 224 lines to a thin assembler.
- Pattern is consistent with the Rust commands/ module split (ADR-0030).
- Re-evaluation trigger: if command count grows to the point where the assembler itself becomes a complexity hotspot.
