---
type: ADR
id: "0005"
title: "Tauri v2 iOS for iPad support (vs SwiftUI rewrite)"
status: active
date: 2026-03-27
---

## Context

Laputa runs on macOS via Tauri v2. The goal is to also support iPad without changing the stack or redesigning the app from scratch. The core question: extend the existing stack to iOS, or rewrite in SwiftUI for a fully native experience?

## Decision

**Use Tauri v2 iOS (beta) for the iPad prototype.** The React frontend stays identical. The Rust backend compiles for iOS with `#[cfg(desktop)]` / `#[cfg(mobile)]` guards for platform-specific features. Desktop-only features (git CLI, macOS menu bar, MCP server, Claude CLI) are stubbed or skipped on mobile.

The prototype (`feat: add iPad/iOS prototype via Tauri v2 mobile target`, build `b492`) successfully builds and runs on iPad Pro 13" simulator (iOS 18.3.1).

## Alternatives considered

- **SwiftUI rewrite**: best native macOS/iPad experience, full App Store integration, native TextKit 2 editor. Rejected for now — would discard all existing React code, Rust backend, 2200+ tests, and Claude Code's accumulated context. Worth revisiting if Laputa becomes iOS-first.
- **Capacitor**: replaces Tauri layer, keeps React, but the Rust backend is lost entirely — git and file operations would need reimplementation in JS or Swift.
- **React Native + WebView**: wraps the React app in a WebView. Too hacky, performance concerns, App Store review risks.

## Git on iPad

`git` CLI is unavailable on iOS. Options for production:
- **Option A (recommended)**: `isomorphic-git` — pure JS git implementation, no native dependencies, runs in WebView. Replaces Rust git commands on mobile.
- **Option B (prototype)**: Working Copy as iOS Files provider — user manages git separately.
- **Option C**: iCloud Drive sync — no git history. Not recommended.

## Consequences

- Zero frontend changes needed for basic iPad support
- Desktop features (git, MCP, Claude CLI) unavailable on iPad until isomorphic-git is integrated
- Tauri v2 iOS is still beta — production stability unknown
- App Store distribution requires Apple Developer account and TestFlight
- Triggers re-evaluation if: Tauri iOS remains unstable after 6 months, or iPad becomes the primary target (in which case SwiftUI rewrite becomes rational)
