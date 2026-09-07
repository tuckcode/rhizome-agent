---
session: 2026-09-07-0000
model: Composer
description: >-
  Green UpdateBanner is Rhizome desktop (Tauri), not Prime; stubbed until a
  signed release feed exists — daily-drive via rebuild /Applications .app
---

# In-app green update bar — Rhizome desktop only

**Origin:** Composer · 2026-09-07 00:00 · docs only  
**Confirmed:** green bar = **Rhizome app** update, **not** Prime.

## Verdict

**The bar is real UI for updating Rhizome Agent itself; it cannot offer a real update today because the backend is deliberately stubbed and no signed release feed is wired.**

## What you see

| Piece | Role |
|---|---|
| `UpdateBanner` | Full-width bar above the bottom status strip (blue chrome; green on “restart”) |
| `useUpdater` + `appUpdater.ts` | Front-end check / download / install |
| `app_updater.rs` | Rust side — **always says “no update”** right now |
| Status-bar package + green dot | Same Rhizome signal (+ optional Prime dialog half; ignore for this bar) |

Prime (`usePrimeUpdate`) is separate: it only opens a GitHub page. It never drives this bar.

## What a real update needs

1. Installed product: `/Applications/Rhizome Agent.app` (from a release or `pnpm tauri build` copy).
2. Published **signed** GitHub release with updater archives + `.sig`.
3. Public feed URL in `tauri.conf.json` → `plugins.updater.endpoints` (today: **`[]`**).
4. `createUpdaterArtifacts: true` (today: **false**).
5. Live Tauri check/download in `app_updater.rs` (today: hard stub — always `None` / error).

`pnpm tauri build` alone only refreshes the local `.app`. It does **not** make the bar light up for other installs.

## What blocks today

- **Packaging deferred:** alpha release workflow is manual/paused; endpoints empty.
- **Stub:** `app_updater.rs` refuses to check so we never pull a wrong (old Tolaria) feed.
- **Signing:** updater key / `.sig` path is incomplete or optional in CI; unsigned installs won’t pass a real Tauri updater.
- **Private repo:** release assets may not be fetchable without auth unless the feed is on a public host (e.g. Pages).
- **No usable published Rhizome feed** the app is allowed to read.

## Daily-drive today

Rebuild and replace `/Applications/Rhizome Agent.app` (or run that bundle). Do not wait on the green bar.

## Smallest next step to feel the bar once

Un-stub `app_updater.rs` against a **test** `latest.json` + matching signed artifact for one local build, with endpoints pointing at that feed — or ship one real signed alpha release and wire endpoints. Until then the bar stays idle by design.
