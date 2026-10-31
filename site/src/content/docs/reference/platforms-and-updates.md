---
title: Platforms and updates
description: Which platforms the Rhizome developer preview runs on, and how to update it.
---

Rhizome is a developer preview. It's built and tested on macOS, from source.

| Platform | Status |
|---|---|
| macOS | The preview platform. Build from source; see [Install](../start/install.md) |
| Windows | Builds from source, but isn't supported for daily use yet |
| Linux | Builds from source, but hasn't been checked as an install for someone new |

There is no signed download for a stranger and no Homebrew package. The app reports version `0.1.0`. That's the bundle version, not a promise about every macOS release.

## Update a packaged app

The packaged app checks for **Rhizome** updates on startup when **Check for updates automatically** is on in Settings. You can also click **Check for updates** in the status bar.

If an update is ready, **Update now** downloads and installs Rhizome through the Tauri updater. Restart with the existing Restart control. That offer updates Rhizome only. There is no Prime Chat-engine update check.

Alpha reads the `alpha-latest` feed. Stable reads `stable-latest`. Those tags are prereleases on purpose: GitHub's latest-release URL does not serve alpha builds.

A source `pnpm tauri dev` session is not this path. An unsigned local build cannot install from the signed feed.

## Update a source checkout

1. Commit or push important vault changes first. Your notes are local files, but a clean Git state makes recovery simpler.
2. Pull the latest code: `git pull` in your `rhizome-agent` folder.
3. Run `./install.sh`, then `pnpm tauri dev`.

If you built an `.app` before, replace it with a new build.

## Prime from the CLI

Skip this unless you still run `prime-agent` in a terminal. Chat does not use it. Rhizome does not offer to update Prime. Update that CLI yourself if you need a newer copy.

## Report a platform bug

Open an issue on [GitHub](https://github.com/tuckcode/rhizome-agent/issues) and include:

- Rhizome version.
- Operating system, version and CPU architecture.
- Whether the vault is local-only or connected to a remote.
- Steps to reproduce.
