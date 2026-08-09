---
type: ADR
id: "0015"
title: "Auto-save with 500ms debounce"
status: active
date: 2026-03-19
---

## Context

Manual save (Cmd+S) was the only way to persist editor changes. Users occasionally lost work when switching notes or closing the app without saving. An auto-save mechanism was needed that balanced responsiveness (no perceived lag) with disk I/O efficiency (not writing on every keystroke).

## Decision

**Notes auto-save with a 500ms debounce after the last keystroke. The `useEditorSave` hook watches for editor content changes and triggers a save after 500ms of inactivity. The same `save_note_content` Rust command is used for both auto-save and manual save.**

## Options considered

- **Option A** (chosen): 500ms debounce auto-save — fast enough to feel instant, slow enough to batch rapid keystrokes. Downside: 500ms window where unsaved changes exist.
- **Option B**: Save on every change (no debounce) — zero data loss risk. Downside: excessive disk writes, poor performance, frequent git diffs.
- **Option C**: Save on note switch / app blur only — minimal disk writes. Downside: data loss if app crashes mid-edit, no live preview of changes in other views.

## Consequences

- Users never need to manually save (Cmd+S still works as an immediate save).
- Auto-save triggers vault entry updates, keeping the note list, search, and relationships current.
- The same save path handles wikilink extraction and frontmatter parsing after save.
- Secondary windows (multi-window mode) each have their own auto-save via `useEditorSaveWithLinks`.
- Re-evaluation trigger: if 500ms is too aggressive for low-powered devices or network-synced vaults.
