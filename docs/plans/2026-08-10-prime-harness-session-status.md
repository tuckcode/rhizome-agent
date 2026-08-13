# Session status — 2026-08-09/10 (Prime harness + vault cleanup)

Long session, two machines' worth of work. Read this before picking up.

## Start here if you only read one thing

The repo went from **unpushable** to **7 successful pushes**. `main` had a
broken build that no gate had ever run, because the push had never succeeded
since the fork bootstrap. That is fixed. Everything below assumes a green tree.

Current: `pnpm test` 5205 / 491 files · `cargo --lib` 1357 · all six gates green.

## Prime harness — the actual product work

RPC coverage went **7 → 12 of ~45 commands**.

| Landed | What it gives you |
|---|---|
| `get_prime_session_stats` | tokens, cost, `contextUsage.percent` |
| `compact_prime_session` | compact now, returns `tokensBefore` |
| `set_prime_auto_compaction` | enable/disable auto |
| `steer_prime_session` | **redirect a running turn without discarding it** |
| `follow_up_prime_session` | queue a message for after the turn |
| `Compaction` event | phase / reason / tokens_before — compaction is no longer silent |
| `QueueUpdate` event | steering + follow-up queue depth |

UI shipped: **context meter** above the composer (`62.0k / 200.0k (31%)` with a
pressure-coloured bar), and **steering** — the composer stays live during a
turn, typed text shows "Steer response", empty shows "Stop response".

`prime_session_host.rs` coverage 67.23% → **81.53%** after a dedicated test
pass (4 tests → 15, plus a `TEST_LOCK` for the process-global host singleton
the old tests were racing on).

### Next, in order

1. **`get_messages`** — fetch conversation from Prime. Blocks everything in the
   session story; without it there is no transcript rehydration and no session
   list.
2. **Session list** — `switch_session`, `fork`, `clone`, `set_session_name`.
   This is the Hermes Desktop shape the user pointed at (pinned + grouped by
   time). Needs 1.
3. **Surface `QueueUpdate`** — the event lands but nothing renders queue depth.
4. **In-app Mycelium** — `mindwalk serve` as a Tauri sidecar so the citymap
   renders inside the app instead of launching a browser. Mindwalk is Go +
   React/Three.js over HTTP, so this is the same sidecar pattern as
   `rhizome-tool`, not a rewrite. Prime rides on `pi`, which is *why* Mindwalk
   parses Prime sessions with no translation.
5. Second tier: `set_thinking_level`, `get_available_models`, `cycle_model`,
   and the whole daemon surface (`observe`, schedules, heartbeats) — untouched.

## Memory work — decided, not built

Two research docs landed (`2026-08-10-destination-model-peer-research.md`,
`2026-08-10-memory-mechanics-worth-stealing.md`). Top three, all cheap because
the pieces already exist in-tree:

1. **Pre-write near-duplicate check.** Rhizome already runs BGE-small locally
   via fastembed with `cosine_similarity` and a warm per-vault index — this
   costs **$0 and no new dependency**. Fixes the real bug: `write_distilled_card`
   never reads an existing note and `unique_slug_path` loops to a free path, so
   two distills of one concept produce `event-sourcing.md` and
   `event-sourcing-2.md`.
2. **Temporal supersession frontmatter** (`valid_until:`, `superseded_by:`).
   `resolve_condition_field` falls through to `entry.properties`, so these are
   view-filterable **with no Rust change**.
3. **Two-stage save gate**, copying Prime `/refine`'s shape: cheap judge decides
   whether to act, expensive refiner runs only on approval. Cheaper than the
   current gate, which is "assistant reply > 80 chars".

Standing principle recorded in `IDENTITY.md`: **prefer Prime's mechanism where
Prime has one that works** — with the caveat that Prime's act on
`~/.prime/agent`, so it means adopting Prime's *design* for vault-side work,
not moving durable knowledge out of the vault.

## Folders — designed, parked

`2026-08-10-folders-design.md` is written and complete. Deliberately parked:
this is an agent harness, and folder work was consuming disproportionate time.
Two hard gates recorded there if it ever resumes — views cannot filter by
folder yet (`views.rs:345` has no `folder`/`path` arm), and move cost is
unmeasured (rewriting links scans the whole vault, so moving N notes is
~N × vault size).

## Traps this session actually hit — do not relearn these

1. **`npx tsc --noEmit` is not the build gate.** It reported clean while
   `tsc -b` failed with 4 errors. The gate runs `tsc -b`. Every prior session
   reported green off `--noEmit`.
2. **Desktop and Agent have diverged, and Desktop knowledge does not transfer.**
   `consolidation.rs` and ADR-0163 exist in `rhizome` and **not** here; session
   auto-distill defaults ON there (`value !== false`) and **OFF** here
   (`value === true`). Claims were repeated as fact all session before being
   caught. Verify against *this* repo.
3. **zsh does not word-split unquoted `$VAR`.** Bit three separate times,
   including a backlink check that wrongly reported "zero inbound links" and
   led to a claim that had to be walked back after deleting files. Use python
   or `find -print0` for anything iterating paths.
4. **The manifest can declare a handler that a `Pick<>` union silently does not
   carry**, surfacing only at `tsc -b`. Three commands have hit this
   (`onKeyboardShortcuts`, `onCreateFolder`, and the Mycelium rail unions).
   That union should be derived from the manifest rather than hand-maintained.
5. **Re-run the whole unit suite after a behaviour change**, not just the tests
   you wrote. A stale assertion (`AiWorkspace.test.tsx` asserting
   `toHaveClass('absolute')`) sat failing until the coverage gate caught it.

## Other things that shipped

- **Chat-primary regression fixed.** `056cb75` shipped expanded chat as
  `absolute inset-0`, painting over the editor — three smoke specs were failing
  on it. Now `relative` at bounded `width: 60%`, per `DESIGN.md` §5.
- **File → New Folder**, plus a fresh-vault chicken-and-egg fix (`FolderTree`
  returned `null` with zero folders, so the `+` button did not render either —
  a new vault could never create its first folder).
- **19 pre-existing test failures fixed** by subagent, independently verified —
  assertion counts held or rose, no skips, no weakened matchers.

## Environment

- **Matt Pocock skills: fixed but need a session restart.** 70 broken symlinks
  in `~/.claude/skills/` repaired. Root cause: `~/.claude/skills` is itself a
  symlink to `~/code/mods-plugins/agent-skills/claude`, so relative links
  (`../../.agents/skills/X`) resolved from *there* and missed. Now absolute.
  The Skill tool builds its registry at startup, so they load next session.
  4 remain broken on purpose — they point at
  `/Users/dtc/code/projects/rhizome/skills/`, which no longer exists.
- **`move_note_to_folder` is command-palette only** — not in the Note menu, no
  context menu, not in the manifest. The Rust side is transactional and
  wikilink-safe (verified); only the surfacing is missing.

## Vault (separate repo)

`~/Documents/Rhizome Vault` now has an off-machine backup at
`tuckcode/rhizome-vault` (**private**, confirmed). 15 Portent template notes
removed, 51 notes migrated from the retired Obsidian vault, Inbox 133 → 82.
`~/CLAUDE.md` repointed to `Rhizome Vault/agents/claude/` and all four paths
verified.

`grok-heavy-desktop` (2.7G code repo with its own `.git`) moved out of the
Obsidian vault to `~/code/archive/`.
