# Prime adapter work

**Origin:** Claude Opus 5.5 · 2026-10-17 · moved verbatim from `AGENTS.md` by `/doctor` to cut always-loaded context.

- **Prime adapter work: check the snapshot, do not ingest Prime.** `docs/prime-adapter-surface.json` is the last mechanical read of `DAEMON_COMMAND_TYPES` vs the `"type"` strings we send. Before changing the host:

  ```bash
  pnpm prime:surface            # installed package vs snapshot
  pnpm prime:surface:github     # GitHub latest release tag vs snapshot
  ```

  If it drifts, `--update` after you have understood the diff. Do **not** clone `PrimeIntellect-ai/prime-agent`. User-facing "a newer Prime is out" is already `check_prime_update` / `usePrimeUpdate`; this is the adapter check.

  **The snapshot answers "does this command exist". It never answers "what does this command do".** It is a list of names, and a name is not a meaning. When you need the behaviour, read Prime's own docs — they are installed at `~/.local/lib/node_modules/prime-agent/docs/` (`usage.md`, `models.md`, `rpc.md`, `rlm.md`, `daemon.md`, and ~30 more). Reading one file is not dumping the package; it is the difference between knowing and guessing.

  **Why this is in the rule and not left to judgement.** On 2026-08-29 an agent needed to know what `set_scoped_models` does. The snapshot gave the name; this rule read as "do not look further"; so the meaning was taken from a *repo design note* that called it "a routing halfway house". Prime's own `usage.md` says `/scoped-models` means **"Enable/disable models for Ctrl+P cycling"** — a filter on the model picker, not routing at all. That single wrong assumption was then used to argue against adopting an external router, in a decision document, in front of the owner. One `grep` would have caught it.

  **And Prime's docs are not the last word either.** A 2026-08-16 session found
  Prime's *documented* behaviour diverging from its *actual* behaviour four
  separate times in one day, and probing the live daemon caught it every time.
  So the order of trust is: **live daemon > Prime's docs > this repo's notes.**
  Read `usage.md` before believing a repo note; probe the daemon before
  shipping anything that depends on the answer. `pnpm test:live-prime` and a
  one-off `prime-agent` call are both cheap.
