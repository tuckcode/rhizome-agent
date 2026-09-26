---
session: 2026-09-21T22:23-05:00
model: Cursor Grok 4.7
description: >-
  Rebuilt /Applications from 2a24eed at 22:23 CDT. Update now is NOT RUN.
  Atticus launches and clicks it. GitHub latest Prime is v0.9.5.
commits: 2a24eed
---

# Applications rebuild — Update now not run

**Origin:** Cursor Grok 4.7 · 2026-09-21 22:23 CDT.

## Candidate

| Field | Value |
|---|---|
| Source | `2a24eed` (`origin/main` matches). Product push inside the tip is `4ec3832`. |
| Product diff | None. Uncommitted files are the plan, handoffs, HANDOFF, BOARD, and the footer rule. |
| Path | `/Applications/Rhizome Agent.app` |
| Identity | `ai.rhizome.agent`, arm64, adhoc signature. Bundle mtime 2026-09-21 22:22:42. Binary mtime 22:23. |
| Spotlight | Only that path. The project bundle was removed after install. |

Recoverable prior app: `~/Library/Application Support/rhizome-agent-rebuild/Rhizome-Agent-b7264d6-2026-09-20.zip` (`b7264d6`, 2026-09-20 07:23).

## Environment

- macOS 27.2 (26B5086k), arm64.
- Prime **0.9.3** at `~/.local/bin/prime-agent`.
- GitHub latest release for `PrimeIntellect-ai/prime-agent` is **v0.9.5** (published 2026-09-16). An offer is expected. The apply check is not blocked on a missing release.

## Build

`pnpm tauri build --bundles app` exited 0 in about 66s. Bundle path before install: `src-tauri/target/release/bundle/macos/Rhizome Agent.app`. That copy was deleted after `ditto` and `codesign --force --deep --sign -`.

The Rhizome window was closed. No `RhizomeAgent` process was running. Node helpers from the old app path were still alive. They were not quit.

## Update now

Atticus launched `/Applications` at `2a24eed`. He clicked the bottom-right control labeled **dev**. No update banner appeared.

That label is the build name for version `0.1.0`. The click checks for a Rhizome app update. The Chat engine offer, when the check succeeds, is a small dot beside that label. It is not a banner.

| Case | Verdict |
|---|---|
| Open the update control | **FAIL** — named `dev`. No banner. |
| Active-session protection | **NOT RUN** |
| Start the update | **NOT RUN** |
| Verify the applied result | **NOT RUN** |
| Resume ordinary use | **NOT RUN** |
| Confirm persistence | **NOT RUN** |

Atticus quit the app. The banner build was installed at **2026-09-21 22:43 CDT**. The corner label is `0.1.0`. The Chat engine banner is above the composer. The 22:23 install is zipped beside the `b7264d6` copy. Apply is still **NOT RUN**. Do not downgrade Prime to invent an update.

## Not this session

#46, tray #52 / #13, and #41 wait until Update now is recorded. Import waits for `1`.
