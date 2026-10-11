# Platforms and updates

Source: reference/platforms-and-updates.md
URL: /reference/platforms-and-updates

Rhizome is a developer preview. It's built and tested on macOS, from source.

| Platform | Status |
|---|---|
| macOS | The preview platform. Build from source; see [Install](../start/install.md) |
| Windows | Builds from source, but isn't supported for daily use yet |
| Linux | Builds from source, but hasn't been checked as an install for someone new |

There is no signed download, no Homebrew package, and no release channel yet. The app reports version `0.1.0`. That's the bundle version, not a promise about every macOS release.

## Update Rhizome

There's no in-app updater. To update:

1. Commit or push important vault changes first. Your notes are local files, but a clean Git state makes recovery simpler.
2. Pull the latest code: `git pull` in your `rhizome-agent` folder.
3. Run `./install.sh`, then `pnpm tauri dev`.

If you built an `.app` before, replace it with a new build.

## Update Prime

If you use Prime as the Chat engine, Rhizome checks for Prime updates but never installs one on its own. When an update is ready, click **Update now**. If it fails, update Prime from a terminal.

## Report a platform bug

Open an issue on [GitHub](https://github.com/tuckcode/rhizome-agent/issues) and include:

- Rhizome version.
- Operating system, version and CPU architecture.
- Whether the vault is local-only or connected to a remote.
- Steps to reproduce.