# Push gate tooling: LLVM coverage and Windows

**Origin:** Claude Opus 5.5 · 2026-10-17 · moved verbatim from `AGENTS.md` by `/doctor` to cut always-loaded context.

- **The pre-push hook now sets `LLVM_COV` / `LLVM_PROFDATA` itself** on macOS
  (`ensure_llvm_coverage_tooling`), so exporting them by hand is no longer
  required. It only fills them in when they are unset, so an explicit export
  still wins.

  This used to be a manual ritual before every push:
  ```
  export LLVM_COV="$(brew --prefix llvm)/bin/llvm-cov"
  export LLVM_PROFDATA="$(brew --prefix llvm)/bin/llvm-profdata"
  ```
  Forgetting it failed the Rust lane *after* every other gate had passed,
  costing a full re-run — which is what prompted moving it into the hook on
  2026-08-22. Agents in particular could not win here: shell state does not
  persist between tool calls, so the export had to be repeated in the same
  command as every single push.
  See `docs/CROSS-MODEL-HANDOFF.md` §13 for the full sequence and `cargo llvm-cov` flags.

  **Corrected 2026-08-28:** the hook checked `brew --prefix llvm`, which
  answers with a path whether or not the formula is installed. On a machine
  where Homebrew's llvm had been removed the check passed and the push then
  failed inside cargo with `could not execute process … No such file or
  directory` — an error naming llvm-profdata and not the reason. The hook now
  verifies the binaries exist and falls back to Xcode Command Line Tools
  (`/Library/Developer/CommandLineTools/usr/bin`), which every macOS machine
  that can build this project already has. Rust here is Homebrew's rather than
  rustup's, so `llvm-tools-preview` is not available as a fallback on macOS.

  **On Windows** those two exports are wrong — there is no `brew`. Install the
  toolchain through rustup instead, once per machine:
  ```
  rustup component add llvm-tools-preview
  ```
  `cargo llvm-cov` finds them itself after that, and no environment variables
  are needed. The hook has no platform branch, so this is the first thing a
  Windows push trips on.

  **On Windows, Prime speaks a named pipe** (`\\.\pipe\prime-agent-daemon`). Setup
  and troubleshooting: **`docs/WINDOWS-DEV.md`**. Chat/sessions/goals need a
  live `prime-agent` daemon on that machine. Everything else works, and
  `pnpm dev` against `mock-tauri` drives the session list without a daemon.
