# One Brain: from step 4c to the stated end state

Picks up where `2026-07-05-one-brain-architecture-decision.md` left off. That
doc defined a 6-step strangler-fig sequence and a destination architecture —
"the bundled MCP server becomes the one door agents use." This doc audits
what's actually done against that destination, and sequences what's left.

## What this app is, and where it sits in the wider picture

**Rhizome** (repo `knispo/rhizome-desktop`, some internal docs/code still
say "Tolaria" — same app, earlier name) is a desktop app — Tauri + Rust
backend, React frontend — for managing a **markdown knowledge vault**:
plain `.md` files with YAML frontmatter, git-backed, no proprietary format,
no cloud dependency. Design principles (filesystem as source of truth,
convention over configuration, vault-vs-app-settings) are in
`docs/ARCHITECTURE.md`.

Shoutout: the app originated from the open-source `refactoringhq/tolaria`
project (`README.md`'s badges still point there). That's a credit, not a
relationship to maintain — this repo has no `upstream` remote, doesn't
track or pull from it, and isn't a fork in any working sense. It's its own
standalone repo now, with its own history starting at a single "initial
import" commit on 2026-07-04.

It's also distinct from `knispo/rhizome`, a separate public Python CLI
toolkit the user also maintains (confirmed via `gh api`: real, public,
plain package, unrelated to this app's release infrastructure). Rhizome's
Research panel (Generate/Import/Distill/Ask/History tabs) originally
shelled out to that CLI for its features; the "One Brain" migration this
doc tracks is absorbing those capabilities directly into this app's own
Rust core instead, so it stops depending on a second runtime/repo.

**Where things stand right now** (2026-07-10): CI is green, the app builds
macOS/Linux release artifacts. Windows releases and the public docs site
are the two pieces currently blocked (see handoff notes below). The table
below is the actual state of the One Brain migration.

## Where the original 6 steps actually stand

| # | Step | Status |
|---|---|---|
| 1 | Vault contract + write/read resolver | **Done** — `rhizome_write_location.rs`, `docs/VAULT_CONTRACT.md` |
| 2 | MCP permission gate (`mcp__tolaria__*` reachable in both modes) | **Done** — confirmed in `claude_invocation.rs`: both `CLAUDE_SAFE_AGENT_TOOLS` and PowerUser's tool list include `mcp__tolaria__*` |
| 3 | Absorb search (Rust index, retire Python `rhizome-search` for the in-app path) | **Done** — step 3a/3b, `rhizome_search/` |
| 4 | Rebuild research/distill/import on the agent layer | **Done** — 4a (Distill), 4b (Import), 4c (Generate), all this month |
| 5 | Demote the CLI dependency (drop `rhizome_check_availability`, the banner) | **Done** — happened incrementally: Ask tab (step 3b), then Distill/Import (4a/4b), then Generate (4c, this session). `rhizome_discovery` module deleted entirely. |
| 6 | Memory, properly (fact store, tiers/decay/session-transcripts) | **Not started** |

Five of six original steps are done. The in-app path (Research panel +
in-app AI chat) fully matches the destination diagram: zero Python
subprocesses left in `rhizome_commands.rs`'s dispatch, everything routes
through the agent layer or the Rust search index.

## The gap the destination diagram doesn't have yet: the MCP door

The architecture doc's diagram shows *external agents* and the *in-app
Research panel* both funneling through the same Rust core. That's true for
the Research panel. It is **not** true for external agents yet:

- `mcp-server/index.js` still shells Python for all six verbs
  (`rhizome_search`, `rhizome_distill`, `rhizome_import_source`,
  `rhizome_repo_research`, `rhizome_generate_wiki`, `rhizome_grok_import` —
  12 shell-out call sites, grep-confirmed).
- This was deliberately deferred at every step (3b, 4a, 4b, 4c) for the same
  reason each time: `mcp-server/index.js` runs as a separate Node process
  with no live request/response channel into the running Tauri app. The
  existing `ws-bridge.js` only relays UI state one-way; it's not a callback
  channel.
- `rhizome_grok_import` specifically has **zero in-app callers** (confirmed
  again this session, grep of `src/`) — external agents are the only thing
  that ever calls it. It cannot be "demoted" the way the other five were;
  it stays 100% Python until the bridge exists.

This is the real remaining piece of "one door agents use." Until it lands,
there are still two doors: the Rust core (Research panel, in-app chat) and
the Python CLI (external MCP agents).

### What building the bridge actually requires

Two options, both real infrastructure (not incremental like 4a-4c):

1. **A compiled Rust sidecar** the Node MCP process execs directly (calling
   into the same logic `rhizome_commands.rs` uses, minus the Tauri
   `AppHandle`/event-emission parts). Cost: `externalBin` packaging,
   cross-platform binary naming, macOS signing/notarization for the sidecar
   — none of which this app has today.
2. **Two-way request/response plumbing** between the Node MCP process and
   the running Tauri app (upgrade `ws-bridge.js` from one-way broadcast to
   a real RPC channel, or add a local IPC socket the MCP server can call).
   Cost: new protocol, new failure mode (what does an MCP verb do if the
   app isn't running?), auth/trust boundary for a local socket.

Either one is a single, focused engineering push that cuts over all six
verbs at once — not six separate small sessions. Recommend scoping it the
same way `2026-07-08-step3-absorb-search-scope.md` and the step-4 scope doc
were scoped: a dedicated locked-decisions doc before writing code, because
the sidecar-vs-socket choice has real packaging/security tradeoffs worth
getting right once rather than iterating live.

## Step 6 (Memory) — still just an idea, not scoped

The architecture doc's step 6 says "design the fact store on top of the
absorbed index (tiers/decay/session-transcripts), new ADR at that point."
Nothing has moved here — `rhizome-memory`'s Python equivalent was already
noted as dormant (0 facts in the real vault) at decision time, so there's
no migration pressure, only a green-field design question whenever it
becomes a priority. Not urgent; sequence after the MCP bridge unless a
concrete need surfaces first.

## Backlog accumulated across steps 3-4c (small, don't need a bridge)

These don't block or depend on the MCP bridge — pick any of them up
independently, cheaper than either big remaining piece:

- **Flaky test**: `vault::getting_started::tests::test_canonical_getting_started_path_accepts_cloned_starter_vault`
  is order-dependent under `cargo llvm-cov --test-threads=1`. Noted in the
  07-09 session status, still unfixed. Per AGENTS.md's TDD desiderata
  ("Fix flaky tests first"), this is overdue for its own short session.
- **`.husky/pre-push`'s CodeScene block**: dead code since ADR-0149 dropped
  the CodeScene gate (no free tier). Soft-skips today, harmless, but
  flagged as a deliberate follow-up to actually remove — a separate,
  permission-scoped edit to the push-gate script itself.
- **l10n staleness**: 19 locale files are missing ~69 keys each,
  accumulated across sessions with no `LARA_ACCESS_KEY_ID`/`SECRET` in the
  environment. Needs one `pnpm l10n:translate` run with real credentials.
- **Ask-tab path inconsistency**: Ask results are relative to `wiki_root`
  (matching Python's old `page` field), Library items are relative to the
  vault root (`wiki/` prefix included). Invisible today because the real
  vault is still flat; will surface the moment a vault migrates to the
  nested `wiki/` layout the contract already documents.
- **Generate tab cancellation**: a deep run is 4 sequential agent calls
  with no abort affordance in `ResearchPanel.tsx`. Noted as a known gap in
  the 4c scope doc, deferred each time so far.
- **Repo-cache eviction**: `.rhizome/repo-cache/` (added this session,
  ADR-0151) has no size cap or LRU policy — deliberately deferred until
  disk growth is a real problem, not a hypothetical one.

## Recommended sequencing

1. **Backlog items first** (flaky test, CodeScene dead block, l10n) — each
   is a short, independent, low-risk session with no design work needed.
2. **Scope the MCP bridge** as its own locked-decisions doc (sidecar vs.
   socket) before writing any code — this is the one piece left that
   actually completes "one door agents use."
3. **Build the MCP bridge** — the real remaining engineering lift, on the
   scale of step 3's search absorption.
4. **Memory (step 6)** — green-field design, sequence whenever it becomes
   a priority; nothing else is blocked on it.

## Handoff notes: what's *not* written down anywhere else

Everything above cites a doc. The five items below only exist in this
session's conversation — read them before assuming the rest of this repo's
markdown is the complete picture, especially if picking this up with a
model/agent that has no memory of this session.

- **Release (Alpha)'s Windows job is currently failing on
  `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_KEY_PASSWORD`, and this is *not* the
  same thing as the paid Authenticode certificate.** These two are Tauri's
  own updater signing keypair, generated for free with `tauri signer
  generate` — no CA, no cost. The thing that costs money and is correctly
  optional is `WINDOWS_CODE_SIGNING_CERTIFICATE` (Authenticode, see
  `docs/adr/0139-temporary-windows-authenticode-soft-gate.md` and
  `.github/SETUP.md`'s "Windows Authenticode release signing" section —
  both correctly describe the *paid* cert as optional, but don't call out
  that the updater key is a separate, free, still-required secret). Don't
  let a future session conflate "skip Windows signing" with "skip the
  updater key" — they're different secrets with different cost.
- **GitHub Pages requires GitHub Pro (or Team/Enterprise) for private
  repositories** — confirmed directly against the Pages API this session
  (`422: Your current plan does not support GitHub Pages for this
  repository`). Nowhere in the repo's docs. Relevant if `site/` (the
  VitePress marketing/docs site — see `.github/workflows/deploy-docs.yml`)
  ever needs to actually deploy.
- **Two settled decisions, not written anywhere**: stay private for now,
  and don't pay for Windows Authenticode signing. A future session without
  this context could easily "rediscover" the resulting red CI checks as
  bugs and burn time re-litigating both. `deploy-docs.yml`'s trigger was
  restricted to `workflow_dispatch` specifically because of the first
  decision (see its own top-of-file comment and commit `6886e668`).
- **`AGENTS.md`'s native-QA section points at
  `~/.openclaw/skills/tolaria-qa/scripts/` — this path does not exist on
  this machine**, confirmed this session. Any agent following that section
  literally (Claude Code or otherwise) hits a dead end at the screenshot
  step. Either the scripts need to be vendored into the repo (so QA doesn't
  depend on an out-of-repo, per-machine skill directory) or `AGENTS.md`
  needs a note on how to actually get/install them.
- **A pnpm major-version lockfile gotcha from this session, not documented
  anywhere persistent**: pnpm 10 (pinned in `.github/workflows/ci.yml` via
  `pnpm/action-setup`) and pnpm 11 (this machine's local install) serialize
  `patchedDependencies` differently in `pnpm-lock.yaml` — one writes a flat
  hash string, the other a nested `{hash, path}` object. Regenerating the
  lockfile with a local pnpm that doesn't match CI's pinned major version
  will silently reintroduce `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` in CI even
  though `--frozen-lockfile` passes locally. Always regenerate with
  `CI=true npx pnpm@10 install --no-frozen-lockfile` (matching whatever
  version `ci.yml` currently pins) if `package.json`, `pnpm-workspace.yaml`,
  or the patch set ever changes. Full story in commits `dac4bc39` and
  `f0ec42e4`.

### Docs worth pointing a fresh model at directly

For a handoff, these are the load-bearing docs, roughly in read order:
`AGENTS.md` (process/gates — but see the QA-script caveat above),
`docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, `docs/VAULT_CONTRACT.md`,
`docs/adr/README.md` (ADR template/index),
`docs/plans/2026-07-05-one-brain-architecture-decision.md` (the destination
this whole roadmap measures against), this file, and whichever
`*-session-status.md` in `docs/plans/` has the latest date.
