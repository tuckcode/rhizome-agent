# One Brain — session status (2026-07-08)

Picks up from `2026-07-05-one-brain-architecture-decision.md`. Steps 1-3b
done this session, all committed locally, **none pushed**.

## Commits (local, unpushed)

```
b04656ad feat: vault contract + write-location resolver (step 1)
bb6f5da0 fix: wire tolaria MCP tools into agent allowlist (step 2)
1f118fd2 docs: scope One Brain step 3 (absorb search) with locked decisions
13e5aef6 feat: resident tantivy+fastembed-rs index for Rhizome wiki search (step 3a)
6d6ac7e0 test: add manual parity harness for rhizome_search vs Python rhizome-search
eeb029fe feat: cut Ask tab over to the in-process Rhizome search index (step 3b, partial)
```

## What's verified

- Full lib test suite (1074+ tests), clippy clean, fmt clean.
- Parity proof: Rust index vs Python `rhizome-search` on the real Rhizome
  Vault, 10 queries — 9/10 identical top-1, ~73% avg top-10 overlap.
- Live click-through in the actual built app (`Rhizome.app` debug bundle):
  Ask tab, query "event streaming" → "Event Streaming" note as top hit.
  Confirmed screenshot-verified, not just unit tests.

## Known gaps, not bugs (already documented in ARCHITECTURE.md)

- MCP-facing `rhizome_search` verb (external agents, `mcp-server/index.js`)
  still shells Python. Cutting it over needs either a compiled Rust sidecar
  (new `externalBin` packaging/signing infra — this app has none today) or
  new two-way bridge plumbing. Deliberately deferred as its own follow-up.
- Search index builds lazily on first query per vault, doesn't auto-refresh
  after edits within the same app session (no watcher wiring yet, no manual
  reindex trigger).
- Ask-tab result paths are `wiki_root`-relative; Library-panel paths are
  vault-root-relative (include `wiki/` prefix). Invisible today since the
  real vault is still flat; will matter once the vault migrates to nested
  `wiki/` layout. Pre-existing gap (Python had it too), not introduced here.
- Real "Rhizome Vault" is still flat (no `wiki/` subfolder) — the step-1
  decision to adopt nested `wiki/` layout means `rhizome_scan_library` now
  correctly returns 0 items against it until that vault is migrated. Known,
  not a regression.

## Blocking decision before push

**Pre-push gate conflict — narrower than first thought.** Verified actual
current pricing for both tools (not just memory) before concluding:

- **Codacy is NOT actually blocked.** Its local CLI (`codacy-cli-v2`, MIT,
  [github.com/codacy/codacy-cli-v2](https://github.com/codacy/codacy-cli-v2))
  runs fully locally, no account, no payment — doesn't care about
  public/private since it never touches Codacy's cloud dashboard unless you
  opt into uploading. This is exactly the `.codacy/cli.sh analyze` fallback
  AGENTS.md already documents. Only the cloud dashboard product (Team plan,
  $18-21/dev/month) is paid, and the gate doesn't need it.
- **CodeScene has NO free path at all**, confirmed across every surface:
  cloud plans (Standard €18/mo, Pro €27/mo per active author), the `cs` CLI
  (requires a licensed project token), and even the standalone local-only
  "CodeHealth MCP" (runs on your machine, but still needs a paid CodeScene
  account — €8-9/mo after a 14/30-day trial). User has confirmed: will never
  pay for this, on this repo, period.
- Neither tool is actually wired up in this repo right now — no `.codacy/`
  dir, no CodeScene MCP connected this session. So nothing is *currently*
  blocking a push; this is a policy conflict in AGENTS.md's documented
  process, not a live technical blocker.

**CodeScene's job, for context:** git-history-aware Hotspot analysis
(complexity × change-frequency, prioritizes refactor effort) + knowledge
distribution (bus-factor). Different job from Codacy (stateless per-commit
linting/security). They're complementary in AGENTS.md, not redundant — any
replacement needs to cover the hotspot/trend angle specifically, not just
"a free linter."

**Real free alternatives for CodeScene, if we want one** (not drop-in,
real work to wire up):
- [`code-maat`](https://github.com/adamtornhill/code-maat) (GPLv3) — the
  actual open-source tool CodeScene's creator (Adam Tornhill) built and
  later commercialized. Mines git log for the same hotspot/knowledge-
  distribution math. Free, self-hosted, CLI — but raw CSV output, no
  built-in score/threshold, you build the gate logic yourself.
- [SonarQube Community Build](https://www.sonarsource.com/open-source-editions/sonarqube-community-edition/)
  — free, self-hosted, unlimited, supports TS + Rust, A-E maintainability
  rating, 5000+ rules. NOT git-history-aware (no change-frequency
  weighting), single-branch only in the free tier.
- A real replacement = SonarQube (per-file quality rating) + code-maat
  (change-frequency weighting) combined. Covers both jobs CodeScene does,
  for $0, but it's new plumbing — not a config flip, and not the same score
  formula as `.codescene-thresholds` (would need a new baseline).

**Next session should:**
1. Decide: drop CodeScene from the mandate entirely, or invest in wiring
   SonarQube + code-maat as its free replacement.
2. Update AGENTS.md's pre-push mandate to match whatever's decided — stop
   citing a paid tool the user won't enable. Do NOT use `--no-verify` or
   silently lower thresholds as a workaround.
3. Codacy's local-CLI leg can stay as documented (`.codacy/cli.sh`) — it's
   already free, just not yet actually set up (no `.codacy/` dir exists).
4. Once the gate reflects reality, run it and push these 6+ commits to
   `origin main`.

## Step 4 (not started)

Rebuild `research`/`distill`/`import-source`/`grok-import` on the app's
existing agent layer + write resolver, per the original One Brain plan.
This is a bigger lift than everything above combined — three separate
features currently shelling Python, each needs its own prompt+write-resolver
wrapper. Scope it fresh next session rather than starting cold.
