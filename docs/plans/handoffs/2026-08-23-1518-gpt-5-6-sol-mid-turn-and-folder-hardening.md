---
session: 2026-08-23T15:18Z
model: GPT-5.6 Sol
description: >-
  Fixed C43/C44 message-loss races, hardened destructive folder commands against
  arbitrary roots and the vault root itself, and got the Codacy gate actually
  running — its first scan refuted the prior review's IPC-reachability premise
  (tauri CVE-2026-42184), so tauri, dompurify, and mermaid are patched. C45.
  Also evaluated NVIDIA NeMo Switchyard as an experimental router behind Prime
  and decided Prime sessions should be foreground-owned by default (ADR-0167).
commits: a2895bf, 2d12ca5, 7813c0c, plus the documentation commit containing this handoff
---

# Mid-turn messaging and folder hardening — 2026-08-23

## Implemented

- Prime follow-ups now return the daemon's real `data.queued` admission result;
  successful steer retains its existing success semantics.
- Frontend mid-turn sends distinguish accepted, no-longer-running, and transport
  failure. A declined queue falls back through the latest idle controller
  instead of the active render's stale callback; transport failure preserves
  the draft.
- `rename_vault_folder` and `delete_vault_folder` now require an exact
  registered vault root and validate the target as writable inside it before
  reaching filesystem mutation.
- **`folder_path` can no longer resolve to the vault root.** The traversal guard
  only looked for `..`, so `.` and `./` passed and `delete_folder` reached
  `remove_dir_all(<vault root>)`. That is worse than it sounds: `remove_dir_all`
  empties a directory before removing it, so the vault's contents were being
  deleted even on macOS, where only the final `rmdir` fails with `EINVAL`. The
  fix strips `CurDir` components and rejects an empty remainder, at the
  `vault::folders` seam where both commands pass through.
- **Codacy runs now (C45).** `codacy-cli` needs no account and no payment; the
  gate had been reporting itself unrunnable on a claim that only applies to the
  paid MCP server. Setup, the trimmed tool set, and why Codacy's eslint is
  excluded are documented in `AGENTS.md`.
- **Patched the advisories the first scan surfaced**, beginning with three that
  undercut the 2026-08-22 review's reasoning rather than merely being old: `tauri`
  2.10.2 → 2.11.1 (CVE-2026-42184 origin confusion — remote pages could invoke
  IPC on Windows/Android, contradicting "IPC is only callable from the app's own
  webview"), `dompurify` 3.4.2 → 3.4.13 (XSS) and `mermaid`
  11.14.0 → 11.17.0 (CSS injection), both on the `SafeMarkup.tsx`
  path the review cited as the reason no XSS could reach IPC.
- Patched every remaining High dependency finding plus two reachable/easy
  Mediums: `@hono/node-server`, `fast-uri`, `hono`, `ip-address`, `js-yaml`,
  `linkify-it`, `nanoid`, `postcss`, `protobufjs`, `vite`, `quinn-proto`,
  `openssl`, `tar`, `markdown-it`, and `serde_with`. Several vulnerable versions
  had been deliberately pinned in `pnpm-workspace.yaml` and
  `mcp-server/package.json`; both override sets now name the fixed versions.
- `ARCHITECTURE.md`, `ABSTRACTIONS.md`, and the existing C43/C44 learned fact in
  `AGENTS.md` were updated to match.

## Verification

- Focused frontend: 46 passed.
- Focused Rust queue/folder regressions: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `cargo fmt --check`: passed.
- `cargo clippy -- -D warnings`: passed.
- Final Rust lane after all dependency patches: **1,631 passed** across
  lib/bin/integration suites; line coverage **85.63%**; clippy and fmt clean.
- Final frontend lane after all dependency patches: **5,677 passed** (541
  files); line coverage **88.06%**.
- MCP tests: **67 passed**.
- Final Playwright smoke: **26 passed** after installing the matching Chromium
  build required by the updated Playwright package.
- Codacy: **run and triaged.** Initial Trivy scan had 95 lockfile occurrences,
  including 23 High. Final scan has **0 Critical, 0 High**, with 9 occurrences
  left: two accepted Medium advisories and four unique Low advisories duplicated
  across versions/locks. C45 records reachability and why the Mediums remain.
  `opengrep`: 0 findings on the touched frontend files (82 rules). `lizard`
  flags `AiPanel.tsx` at CCN 50 / 447 lines — C46.
- `pnpm deadcode`: advisory command still exits on the repository's named
  backlog (2 files, 47 exports, 11 types, 7 duplicate exports, config hints).
  It exposed one finding in a touched file, the unused `AiAgentMessage`
  re-export from `AiPanel.tsx`; that export was removed and does not appear in
  the final report.

## Decision context — Switchyard model routing

Evaluated [NVIDIA NeMo Switchyard](https://github.com/NVIDIA-NeMo/Switchyard)
as a model router for Rhizome Agent. It is a strong **experiment**, not yet a
production dependency.

The recommended boundary is:

`Rhizome Agent → Prime → Switchyard sidecar → model providers`

Prime owns model discovery, session model state, credentials, tools, goals,
compaction, subagents, and execution. Embedding Switchyard in
`ai_models.rs` would only route Rhizome's direct-model path and bypass the Prime
harness, so that is the wrong first integration.

Switchyard's stage router is promising because it routes from agent-native
signals—tool results, errors, exploration, churn, and recent edits—rather than
prompt text alone. But the project is explicitly pre-alpha, and current issues
affect the exact protocol fidelity Prime needs:

- [#515](https://github.com/NVIDIA-NeMo/Switchyard/issues/515): Codex tools can
  be dropped during translation.
- [#502](https://github.com/NVIDIA-NeMo/Switchyard/issues/502): tool-call IDs can
  break multi-turn Anthropic workflows.
- [#521](https://github.com/NVIDIA-NeMo/Switchyard/issues/521):
  system/developer roles can be demoted to user messages.
- [#493](https://github.com/NVIDIA-NeMo/Switchyard/issues/493): subagent-aware
  routing is not implemented.

If revisited: pin a release, run it loopback-only as a sidecar, prove Prime's
full tool/streaming/role workflow through a passthrough route, establish an A/B
baseline, then evaluate stage routing. Do not embed `switchyard-libsy` before
that evidence exists. Dynamic routing will also require Rhizome to distinguish
the logical selected route from the physical model that answered.

Durable wiki note:
`/Users/dtc/Documents/Rhizome Vault/projects/rhizome-agent/switchyard-model-routing.md`.

## Decision — foreground-owned Prime sessions (C47 / ADR-0167)

Atticus does not want agents to remain active indefinitely merely because the
window closed. Prime's heart/core role stands; the lifecycle default changes.

The important separation is:

- **daemon lifetime** — shared Prime infrastructure may remain available;
- **session lifetime** — Rhizome-created work is foreground-owned by default;
- **background permission** — explicit, visible, and revocable per turn, goal,
  heartbeat, or schedule.

The installed Prime 0.7.4 daemon already provides the enforcement mechanism:
`DaemonSessionLifecycle = "resident" | "client_owned"`. Client-owned workers
record an owner and are stopped 30 seconds after that protocol client
disconnects; reconnecting during the grace period cancels cleanup.
`promote_owned_session` converts explicit background work to resident, while
`complete_owned_session` stops owned work.

Rhizome currently does none of that: it omits the `client_owned_sessions`
capability and sends `lifecycle: "resident"` for every new session. Its orderly
quit handler kills the attached session by default, but a crash or force-quit
bypasses that handler and leaves resident work alive. Main-window close merely
hides the window and keeps the socket attached, despite ADR-0163 and
`ARCHITECTURE.md` claiming close is a detach.

The decided UX:

1. New sessions are `client_owned`.
2. Idle window close detaches quietly; the transcript remains resumable.
3. Active close asks, defaulting to **Stop and close**. **Keep working** promotes
   only that session to resident. Cancel leaves the window open.
4. Full Quit stops foreground-owned work and leaves only explicit background
   grants resident.
5. Explicit schedules/heartbeats may continue while Rhizome is closed because
   creating them is itself the grant; they remain visible and cancellable.
6. The global `keep_sessions_running_on_quit` preference is too broad and is
   removed or migrated.

Promotion is one-way. Returning resident work to the foreground-only posture
means stopping its worker and later resuming the durable transcript as a new
client-owned worker. Scheduled work may warrant a dedicated resident session so
ordinary chat is not permanently promoted.

ADR-0167 records the decision and supersedes only ADR-0163's unconditional
session-survival policy. ADR-0163's daemon-client transport choice remains
active. Implementation remains the next separate lifecycle slice after this
security batch.

## Completion notes

- Localization: no UI copy changes.
- PostHog: no new event needed; this repairs existing send semantics and keeps
  the existing `prime_turn_message` event for accepted sends only.
- Refactoring: introduced one explicit tri-state result and one strict
  registered-boundary helper; no broader cleanup.
- ADRs: added ADR-0167, superseding ADR-0163's session-lifecycle policy while
  retaining its daemon-client transport decision. No lifecycle code implemented
  in this batch.
- Native QA: **attempted but blocked.** The existing `pnpm tauri dev` process was
  left untouched. The required Orca computer-use runtime failed to open with
  `runtime_open_timeout` ("Timed out waiting for an Orca desktop window"). Per
  its guide, no alternate desktop driver was substituted. The tauri 2.11.1 bump
  carries wry, tao, muda, and tray-icon, so tray reopen, menu actions, window
  restore, and #43's navigation guard still require native observation before a
  release.
- Demo vault dirt: clean (`git status --short -- demo-vault demo-vault-v2`).
