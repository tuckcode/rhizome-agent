---
session: 2026-09-26T05:59-05:00
model: Claude Opus 5.5
description: >-
  Public-release prep after the Astra redesign: secret scan clean, repo
  email pinned to noreply, AGPL confirmed and Tolaria credited, Cargo
  authors dropped. Pushed 835c5bb. The macOS title bar is planned, not built.
commits: 6bffb37..835c5bb
---

# Public-release prep

**Origin:** Claude Opus 5.5 (Claude Code desktop) · 2026-09-26 05:59 CDT.
Follows [`2026-09-26-0425`](2026-09-26-0425-claude-opus-5-5-astra-redesign.md).

| Field | Value |
|---|---|
| origin/main = HEAD | `835c5bb` |
| App | `/Applications`, built from `d0a55f8` (later commits are docs and metadata only) |

## Findings

- **Secret scan (gitleaks 8.30.1)** covered all 708 commits plus the working
  tree, including untracked files. The only hits are the synthetic
  `xox?-` test tokens in `src-tauri/src/telemetry.rs:346-347`, which are
  scrubber fixtures. No env or key file was ever committed.
- **The Gmail address** `284109516+tuckcode@users.noreply.github.com` authors 530 commits, dated
  2026-08-09 to 09-12. Later commits use the noreply address. Undecided:
  accept it, or rewrite history (new SHAs, a force-push, and breaking about
  30 local worktrees).
- **58 tracked files contain `/Users/dtc` paths.** The handoffs and plans
  also hold personal working context. They need a human read before going
  public.
- **Upstream lineage** is Tolaria (`refactoringhq/tolaria`, AGPL-3.0,
  author Luca Rossi, checked with `gh`) → Rhizome Desktop → this repo. The
  history before `11e1315` is not in this repo. `refactoringhq` still
  appears in `.chunk/config.json` and in `release.yml` / `release-stable.yml`.

## Decisions

- **AGPL-3.0-or-later is confirmed** by Atticus for the public release. The
  README, `docs/PUBLIC-PREVIEW.md` and `mcp-server/package.json` now say so.
- **Cargo `authors` is removed** at Atticus's request. The README credits
  Tolaria by Luca Rossi instead, because that field was the only remaining
  attribution.
- **The repo's `user.email` is set locally** to the noreply address.
- **Jev** (TypeSafe AI's decision model) comes after going public, as an
  experiment on the auto-save gate. The details are in the 0425 handoff.

## Agreed, not built

- **macOS title bar.** Atticus sees a line through the traffic lights when
  the sidebar is collapsed. That line is the 46px rail's border. He wants
  one thin bar across the top holding the traffic lights and Command
  Palette, docked left. The full plan is the task chip "Add a thin macOS
  title bar with Command Palette". The key fact: tao sets the title-bar
  height to button height plus `y`, so a 32px bar needs about `y: 9` in
  `tauri.conf.json`. Linux and Windows already have `LinuxTitlebar` at 32px.

## Unverified

- **Nothing in the redesign has been checked in the packaged app.**
- **7 smoke specs pass only on retry.** It is not known whether that
  predates this session.
