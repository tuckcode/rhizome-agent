# Save-path audit (workstream A) — 2026-07-31

Answers `HANDOFF.md`'s standing question — *"is there even a reliable
trigger/save method for memories/wiki entries?"* — as one connected pass
across all six entry points, per `~/.claude/plans/were-using-usage-credits-inherited-cosmos.md`
workstream A.

**Verdict: the write path is reliable. The trigger path is not — and the
reason is that nothing reads it.** Every gap below is in the event/trigger
half; no entry point was found that fails to write its artifact.

> **Resolved 2026-08-02.** That verdict describes the audit as taken on
> 2026-07-31, and the finding sections below are preserved as written then.
> All 10 findings are now closed — `trigger` got a reader rather than the
> delete. The status table immediately below is the per-finding source of
> truth; prefer it over any prose in this file.

Method: static trace of every writer and reader, plus a shape analysis of a
real 15-event log (`~/Documents/Rhizome Vault/.rhizome/events.jsonl`). No
native run — see "Not covered" at the end.

**Status of the findings, updated as they close:**

| # | Finding | Status |
|---|---|---|
| 1 | `trigger` is write-only | **Fixed** — `sourceFor` in `menuBarActivity.ts` maps it to a label the feed renders |
| 2 | False "exactly ONE place" invariant | **Fixed** `f550ba7b` |
| 3 | Four divergent writers | **Fixed** — one writer per runtime sharing one invariant (ADR-0161 + `mcp-server/vault-events.js`) |
| 4 | Six JS event types can't carry a trigger | **Fixed** — the JS writer now stamps `trigger` (default `"mcp"`) |
| 5 | `rhizome_append_event` defaults to `"menu_bar"` | **Fixed** — now `"mcp"`, via a testable `resolve_append_event_trigger` |
| 6 | `from` hardcoded `"inline"` | **Fixed** — dropped, regression-tested |
| 7 | `let _ =` swallows log failures at 3 of 6 sites | **Fixed** — `append_vault_event_best_effort` logs a warning; swallowing is now named, documented and tested |
| 8 | One malformed line blanks the feed | **Fixed** `f550ba7b` |
| 9 | `verbFor` is out of sync with real event types | **Fixed** — added `research-started`/`research-finished`/`source-imported` plus the five JS-only types |
| 10 | `mcp-server/tool-service.test.js` was never executed by anything | **Fixed** — `pnpm test:mcp` |

**Finding 10 (found while closing 3-5).** `mcp-server/tool-service.test.js`
existed, passed, and was run by **nothing** — no npm script, no husky hook,
no Chunk lane, no workflow. Five tests silently ungated. This is the mirror
image of the `AiAgentsBadge.tsx` incident in `AGENTS.md`: there, code with a
passing suite was rendered from nowhere; here, a passing suite guarded code
nobody ever ran it against.

The reason it was never wired up is worth keeping: **`node --test mcp-server/`
hangs forever**, because the directory form imports `index.js`, which starts
the MCP server and never exits. `pnpm test:mcp` globs `mcp-server/*.test.js`
instead, which terminates in well under a second. Anyone adding a JS test
here should use that script, not the directory form.

**Finding 9 (added during the fix pass).** `verbFor`
(`src/utils/menuBarActivity.ts:18-40`) maps `capture`, `distill`,
`import`/`grok-import`, `repo-research` and `edit`. The types actually
written are `research-started`, `research-finished` and `source-imported` —
none of which it handles, so they all render as the generic fallback
**"updated"**. Meanwhile `repo-research` is in the map and is written by
nobody. In the real 15-event log, 3 of the 4 distinct types display as
"updated". Fix alongside finding 1, since both are activity-feed work.

---

## Finding 1 — `trigger` is write-only. Nothing reads it back.

This is the headline, and it makes the original question partly ill-posed:
you cannot have a "reliable trigger method" when the trigger is never
consumed.

- The activity feed (`src/utils/menuBarActivity.ts:63-67`) maps each event to
  `{verb, target, when}` from `type`, a target field, and `timestamp`.
  **`trigger` is not among them.**
- The only Rust read is `rhizome_commands.rs:127`, which reads `trigger` out
  of *caller args* in order to write it — not a consumer.
- No TS reads it. (`triggerSync`, `triggerCharacter`, `AutoGitTrigger` are
  unrelated concepts; grep for `trigger` in `src/` returns only those.)

So seven-plus distinct trigger values are produced, validated nowhere, and
consumed by nothing. Any belief that History or the activity feed
distinguishes a menu-bar capture from an inbox drop is currently false.

**This is the decision point.** Either give `trigger` a reader (filter or
label it in the activity feed / History) or delete the field. Keeping a
write-only field that six sites carefully populate is the worst of both —
it costs maintenance and buys nothing. Everything below only matters if the
answer is "give it a reader."

## Finding 2 — the "exactly ONE place decides the trigger" invariant is false

`rhizome_jobs.rs:36-40` states:

> there is exactly ONE place that decides the `trigger` — the field the
> activity log uses to say where a capture came from

Both halves are wrong. Trigger is decided independently at **six** sites:

| Site | Value |
|---|---|
| `rhizome_jobs.rs:85` | caller arg, else `DEFAULT_TRIGGER` = `"manual"` |
| `rhizome_commands.rs:127` | caller arg, else `"menu_bar"` |
| `rhizome_repo_research.rs:432,456` | hardcoded `"manual"` |
| `menu_bar_capture.rs:129` | hardcoded `"menu_bar"` |
| `commands/vault/file_cmds.rs:158,182` | hardcoded `"manual_edit"` |
| `mcp-server/index.js` (10 call sites) | **never writes one** |

And the second half — "the field the activity log uses" — is Finding 1.

A comment asserting an invariant the code does not hold is worse than no
comment: it tells the next reader not to check.

## Finding 3 — four independent event writers with divergent field sets

`append_vault_event`'s own doc comment (`rhizome_distill.rs:260-262`) says it
is *"Shared by distill and other write paths (menu-bar capture, import, etc.)
so History / menu-bar activity stay in sync."* Import and repo-research do
not use it.

| Writer | Emits |
|---|---|
| `rhizome_distill::append_vault_event` | `type, from, project, trigger, artifact_path, timestamp` |
| `rhizome_import::append_import_event:270` | `type, source, project, trigger, artifact_path, timestamp` — no `from` |
| `rhizome_repo_research::append_event:313` | arbitrary JSON; started/finished carry `mode, repo, depth` |
| `mcp-server/index.js::appendRhizomeEvent:397` | arbitrary object + `timestamp`; **no `trigger` at any of its 10 call sites** |

`VAULT_CONTRACT.md` makes path drift "impossible by construction" via one
resolver. The event log has the opposite property: four hand-rolled
`OpenOptions::new().append(true)` blocks that each re-implement the same
five lines.

Confirmed empirically — **five distinct field shapes in a single 15-event
file**:

```
('artifact_path', 'from', 'project', 'timestamp', 'trigger', 'type')
('artifact_path', 'mode', 'project', 'repo', 'timestamp', 'trigger', 'type')
('artifact_path', 'project', 'source', 'timestamp', 'trigger', 'type')
('cards', 'project', 'timestamp', 'type')
('depth', 'mode', 'project', 'repo', 'timestamp', 'trigger', 'type')
```

**5 of 15 real events (33%) carry no `trigger` at all.** The `cards` shape
matches no current writer — it is residue from a superseded JS schema, which
is its own finding: the log is append-only across schema versions with no
version field, so any reader must tolerate every shape ever written.

## Finding 4 — six event types can never carry a trigger

`mcp-server/index.js` writes `search`, `lint`, `graph-summary`,
`wiki-generate-started`, `wiki-generate-finished` **unconditionally** (not
gated on `!target.isRust`), so they are live today and structurally
trigger-less. `grok-import`, `research-*`, `source-imported` and `distill`
are gated on `!target.isRust` and are legacy-path only post-One-Brain.

## Finding 5 — `rhizome_append_event` misattributes MCP saves to the menu bar

`rhizome_commands.rs:127` defaults `trigger` to `"menu_bar"`. Any external
MCP agent calling `rhizome_append_event` without an explicit trigger has its
save recorded as a menu-bar capture. The default should be the caller's
actual channel (or a neutral `"mcp"`), not the most specific UI surface.

The same handler also accepts an **arbitrary** trigger string — no
allow-list — so the vocabulary is unbounded by construction.

## Finding 6 — `from` is hardcoded `"inline"`

`rhizome_distill.rs:275` writes `"from": "inline"` for every event
regardless of origin. Only one of the four writers emits the field at all,
and it is a constant. It carries no information.

## Finding 7 — event-log failures are silently swallowed at 3 of 6 sites

`menu_bar_capture.rs:129`, `file_cmds.rs:158` and `file_cmds.rs:182` use
`let _ = append_vault_event(...)`. The note saves; the event vanishes with no
log line and no user-visible signal. Defensible as "don't fail a save
because logging failed" — but it is undocumented, untested, and means a
read-only-tier or full-disk vault silently under-reports activity.

**Fixed 2026-08-02.** `append_vault_event_best_effort`
(`rhizome_distill.rs`) replaces the bare `let _ =` at all three sites. The
behaviour is unchanged on purpose — a failed append still must not fail a
save whose artifact is already on disk — but it now emits a `log::warn!`
naming the event type, trigger and artifact, and the "does not propagate"
contract is regression-tested against a genuinely failing append.

## Finding 8 — one malformed line blanks the entire activity feed

`read_vault_events` (`rhizome_commands.rs:326-328`) does:

```rust
let lines: Vec<&str> = content.lines().rev().take(200).collect();
Ok(format!("[{}]", lines.join(",")))
```

No per-line validation — it string-concatenates into a JSON array. The
frontend then does a single `JSON.parse(raw)` inside a bare `catch {}`
(`useMenuBarCompanionVault.ts:53-60`) that leaves prior state, i.e. an empty
feed on first open. So one bad line — a truncated write, a hand-edit, a
future schema change — takes out all 200 events, silently.

Fix is small: parse per line in Rust and skip what doesn't parse.

Also note the reader caps at the newest 200 lines and nothing rotates
`events.jsonl`, so it grows without bound.

---

## Entry-point coverage

All six write their artifact correctly. The right-hand column is the gap.

| # | Entry point | Write path | Trigger written |
|---|---|---|---|
| 1 | Research panel | `rhizome_repo_research.rs:432,456` | `"manual"`, hardcoded |
| 2 | Menu-bar | `menu_bar_capture.rs:129` | `"menu_bar"`, swallowed on failure |
| 3 | Inbox watcher | `inbox_action.rs:143` | `"inbox"` via param |
| 4 | MCP | Rust: `rhizome_commands.rs:132` / JS: `mcp-server/index.js` | Rust: arg or `"menu_bar"`. **JS: none** |
| 5 | CLI / jobs | `rhizome_jobs.rs:85` | arg or `"manual"` |
| 6 | Hand-edit | `file_cmds.rs:158,182` | `"manual_edit"`, swallowed on failure |

---

## Recommended order

1. **Decide Finding 1 first** — reader or delete. Everything else is
   contingent on that answer, and doing 2-8 before it risks polishing a
   field that should not exist.
2. **Finding 8** — per-line parse. Small, self-contained, strictly a
   robustness win regardless of how 1 goes.
3. **Finding 3** — collapse the four writers onto one, the way
   `rhizome_write_location` already did for paths. This is the structural
   fix; findings 2, 5 and 6 mostly dissolve once there is one writer.
4. **Finding 5** — at minimum stop defaulting to `"menu_bar"`.
5. **Finding 2** — correct or delete the false comment. Do this even if
   nothing else happens; it actively misleads.
6. **Finding 7** — decide and document whether swallowing is intended.

An enum for `trigger` is the obvious follow-on to 3, but it only pays off
after 1 says the field survives.

## Not covered

- **Native run: partial (2026-07-31).** `pnpm tauri dev` builds and launches
  with every change in this session; the real vault loads (110 notes), no
  panic, log clean — so the rewritten `read_vault_events` and the
  consolidated `vault_events` writer are exercised at startup. The tray icon
  is present and its menu opens (Capture Area / Capture Fullscreen / Capture
  Window… / Quick Note… / Open Rhizome / Quit Rhizome).

  **The activity feed itself is still unverified.** The companion popover
  (window id 794) never came on-screen: macOS menu tracking runs a modal
  event loop that ignores synthesized `CGEvent`s, so no scripted click can
  activate "Quick Note…", and keyboard navigation risks firing "Capture
  Area" instead. **This is a harness limitation, not an app bug** — do not
  record it as one.

  To finish it, either click the tray menu by hand with a vault whose
  `.rhizome/events.jsonl` contains a deliberately malformed line (that
  fixture reproduces finding 8 exactly: the old code emitted unparseable
  JSON, so the feed rendered empty), or add a test-bridge/Playwright route
  into the companion window. Worth knowing: **the companion is the only
  consumer of `rhizome_read_events`**, so nothing else in the app exercises
  that path.
- **Onboarding leg untouched.** The audit starts at "a save is attempted."
  Whether first-run onboarding reliably *reaches* a first save is C9/C10
  territory.
- The audit pass itself was read-only; fixes landed afterwards in separate
  commits — see the status table at the top for which findings are closed.
