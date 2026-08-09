---
type: ADR
id: "0001"
title: "Tauri v2 + React as application stack"
status: active
date: 2026-02-14
---

## Context

Laputa is a desktop app for macOS (with iPad as a future target) that reads and writes a vault of markdown files. The app needs a native feel, filesystem access, git integration, and a rich text editor. A single developer (with AI assistance) is building it.

## Decision

Use **Tauri v2** (Rust backend + WebView frontend) with **React + TypeScript** for the UI, **BlockNote** for the editor, and **Vitest + Playwright** for testing.

## Alternatives considered

- **Electron**: heavier runtime (~150MB), slower, but more mature ecosystem. Rejected — Tauri is lighter and has better native integration.
- **SwiftUI**: best native macOS/iOS experience, but locks to Apple platforms only, no code sharing with a potential web version, and requires rewriting the entire UI. Rejected for the initial version — revisited in ADR-0005.
- **Flutter**: cross-platform but WebView-based editor would have been poor; Dart ecosystem is thin for markdown tooling.
- **Pure web app**: no filesystem access, no git, would require a backend server. Rejected — offline-first is a core principle.

## Consequences

- React frontend can be shared with a future web version
- Rust backend provides safe, fast filesystem/git operations
- Tauri v2 supports iOS (beta) — see ADR-0005 for iPad strategy
- CodeScene code health monitoring applies to both Rust and TypeScript code
- Claude Code can work on both layers without context switching
- Triggers re-evaluation if: Tauri iOS proves unstable for production, or if SwiftUI becomes the primary target platform
