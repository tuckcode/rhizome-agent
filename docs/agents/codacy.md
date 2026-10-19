# Security scan with Codacy

**Origin:** Claude Opus 5.5 · 2026-10-17 · moved verbatim from `AGENTS.md` by `/doctor` to cut always-loaded context.


Use Codacy as a security and static-analysis gate before a task is considered releasable.

- **Run the local CLI. It needs no Codacy account and no payment** (corrected
  2026-08-23 — see below):
  ```bash
  codacy-cli analyze --tool trivy                 # vulnerable deps, whole repo
  codacy-cli analyze --tool opengrep <path>        # security patterns
  codacy-cli analyze --tool lizard <path>          # complexity
  codacy-cli analyze --tool trivy --format sarif -o trivy.sarif
  ```
  Per machine, once: `brew install codacy/codacy-cli-v2/codacy-cli-v2` then
  `codacy-cli init` (local mode) and `codacy-cli install`. `.codacy/` is
  gitignored, so every machine and every fresh clone repeats those three
  commands; `.codacy.yaml` at the repo root (tracked) holds the shared
  exclude list.
- **`codacy-cli init` defaults to every language it can find** — Dart, Go,
  Java, and Python runtimes for a TypeScript-and-Rust repo. Trim
  `.codacy/codacy.yaml` to `lizard`, `opengrep`, `trivy` (runtime:
  `python`). Codacy's `eslint` is deliberately excluded: it pins eslint 8,
  ignores plugin rules, and this repo's own `pnpm lint` (eslint 9, flat
  config, typescript-eslint) is strictly stronger. Rust is not covered by
  any Codacy tool — `cargo clippy` is that lane.
- **The MCP server is the part that costs money, and it is optional.**
  `@codacy/codacy-mcp` refuses to start without `CODACY_ACCOUNT_TOKEN`, and
  an account covering a **private** repo (`tuckcode/rhizome-agent`) is paid.
  Its `codacy_cli_analyze` tool just shells out to the same CLI, so the gate
  loses nothing by running the CLI directly. What the token would add is the
  hosted dashboard and trend history — not analysis capability.
- **This gate reported itself unrunnable for months, and that was wrong.** The
  rule used to say the paid-tier blocker applied to the whole gate and told
  agents to write "Codacy: not run" in the completion comment, so every
  session dutifully skipped it. The CLI's own README says it runs "for local
  code analysis without a Codacy account." The first real run (2026-08-23)
  found 95 advisories across the three lockfiles, two of which directly
  contradicted a prior security review's reasoning — C45. A gate nobody can
  run is indistinguishable from a gate that finds nothing, which is exactly
  how it read until someone checked the claim instead of repeating it.
