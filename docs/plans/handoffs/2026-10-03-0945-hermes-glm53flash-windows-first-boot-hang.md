---
session: 2026-10-03 ~08:12–09:50 CDT (Hermes desktop, Windows 11 host)
model: Hermes Agent · z-ai/glm-5.3-flash
description: >
  Windows first boot per .hermes/plans/2026-10-03_080705-windows-first-boot.md.
  App compiles, boots natively, and connects to the Prime daemon over the named
  pipe, but the window hangs deterministically a few seconds after boot: the
  main thread blocks forever in a pipe write. Root cause narrowed to the
  Windows transport having no write timeout; fix not landed.
---

# Windows first boot — app boots, pipe connects, window hangs on a pipe write

**Verdict up front:** the app runs on Windows. Compile, native boot, WebView2
render, daemon connect (protocol 7) all verified. The remaining defect is a
main-thread deadlock inside the Rust named-pipe client, reproducible 3/3.

## Verified working (do not re-derive)

- `cargo build`, `cargo clippy -D warnings`, `cargo fmt --check` all exit 0.
- Frontend gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test`
  (6899 pass / 1 skip), `pnpm test:mcp` (88 pass / 0 fail).
- Native boot 3 times: `target\debug\RhizomeAgent.exe` opens, WebView2 renders
  the full UI (menu bar, session list, chat panel, vault pill for
  demo-vault-v2), no Rust panic in the log.
- The app connects to the Prime daemon:
  `Connected to Prime daemon 0.8.0 (protocol 7) at \\.\pipe\prime-agent-daemon`.
- Prime daemon 0.8.0 healthy on this machine: `prime-agent status` →
  `\\.\pipe\prime-agent-daemon … current`.
- Full app command sequence replayed from Node against the live daemon with
  zero errors: hello → `list` → `create` (client_owned, demo-vault-v2 cwd) →
  `attach` (all 4 capabilities) → `get_state`. A worker spawned and served.
- Concurrent roster polling (16 polls while a session existed) never wedged.

## The unresolved defect

**Symptom.** A few seconds after boot the window stops pumping: Windows shows
"(Not Responding)", UIA/Get-Process.Responding = False, CPU ≈ 0. Reproduced 3/3
(dumps `rhizome-hang2.dmp`, `rhizome-hang3.dmp` in the Hermes scratch dir).

**Stack (fully symbolized, hang2 dump, main thread tid 20440):**

```
WriteFile (synchronous_write, blocked forever)
← write_raw                prime_session_host.rs:3762
← send_bare_command        prime_session_host.rs:3833
← find_resumable_session   (hang2) / ensure_session→create_session (hang3)
← connect / connect_and_store / ensure_host_for_cwd
← ensure_prime_session_host        ← SYNC Tauri command, main thread (hang2)
← get_available_prime_models       ← SYNC Tauri command, main thread (hang3)
```

Hang3 is the key result: the frontend's model-catalog call
(`get_available_prime_models`) — a *different* sync command — wedged the same
way, inside `ensure_session` → `create_session` → `write_raw`. So the async
conversion of `ensure_prime_session_host` / `get_prime_session_host_status`
(already applied, uncommitted, in `src-tauri/src/commands/ai.rs`) is
**necessary but not sufficient**: every remaining sync command that reaches
`write_raw` can still freeze the window.

**Mechanism (high confidence).** On Windows the daemon stream is a
`std::fs::File` over the named pipe opened synchronously. `write_all` has no
timeout, and `set_read_timeout`/`set_write_timeout` do not exist for it — the
code admits this at `prime_session_host.rs:1039-1053` (roster path) and relies
on channel-wait timeouts elsewhere. When the daemon's per-connection reader
stops being serviced, a small write still blocks once the outstanding bytes
exceed the pipe buffer, and the calling command never returns. On macOS the
Unix-socket timeouts bound the same stall.

**Daemon-side observation (secondary, possibly the trigger).** Prime's
supervisor on this machine logs, on older runs (2026-08-23, 2026-09-27):

- `Supervisor command ack_result failed: EPERM: operation not permitted, fsync`
  at `CommandRecoveryJournal.compact/acknowledge` (Windows fsync bug), and
- `Daemon catalog exited (1)` (the saved-session catalog subprocess dies).

During the app sessions on 2026-10-03 the supervisor logged **nothing** — it
never even started a worker for the app's connection. Node probes ran fine
immediately after each force-kill, so the daemon recovers once the app's
handles close.

**What it is not** (all tested live): not the `.cmd` shim (worker spawn and
`create` work), not a daemon crash (healthy before/after), not roster
concurrency (0/16 timeouts), not the linker or toolchain.

## Suggested next moves for a fresh session

1. Reproduce the wedge with a standalone **Rust** client (not Node): open the
   pipe the way `connect_stream` does, then write two small commands back to
   back without reading. If a small write blocks while the daemon is
   processing an earlier command, the 0-buffer/unserviced-read theory is
   confirmed. Node probes always interleave reads, which may be why they
   never wedge.
2. Real fix candidates for `prime_session_host.rs` (Windows branch only):
   - open the pipe with `FILE_FLAG_OVERLAPPED` and give `write_raw`/reads an
     overlapped wait with a timeout, or
   - move the write to a dedicated writer thread and bound the wait with the
     existing channel timeouts.
3. Sweep every sync `#[tauri::command]` that can reach `send_*_command` and
   make it `async` (same pattern as the two already converted). Grep for
   `send_command|send_bare_command|call(` callers in `commands/`.
4. Ask Prime about the Windows `fsync EPERM` journal bug and the catalog
   `exit (1)` — probe the live daemon first per AGENTS.md (`pnpm
   test:live-prime`, `prime-agent` one-shot).

## Environment notes (Windows)

- **MSYS PATH poisons Rust builds.** The `terminal` tool's git-bash PATH makes
  rustc pick GNU coreutils `link` ("Try 'link --help'"). Any cargo invocation
  from a shell must reset PATH first:
  ```
  powershell -NoProfile -Command '$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User"); cargo build ...'
  ```
- **VS Build Tools 2022 (C++ workload) and LLVM 23 are now installed**
  (winget). `rustup component add llvm-tools-preview` is installed too.
- **Symbolization recipe that works** (nothing else did: dbghelp via ctypes
  resolves no symbols, plain llvm-symbolizer needs these flags):
  ```
  llvm-symbolizer --obj=RhizomeAgent.exe --pdb=RhizomeAgent.pdb --relative-address --functions=short
  ```
  Feed it RVAs (module base from the dump + frame offsets). DIA/msdia path
  setup only needed for `--dia`; the native PDB reader works without it.
- **Minidump recipe:** `rundll32 comsvcs.dll, MiniDump <pid> <path> full`
  writes it, but the file lands with an ACL readable only by elevated
  Administrators; one `icacls <file> /grant Admin:R` under a UAC prompt makes
  it readable. Parse stacks with the Python `minidump` package (use
  `memory_segments_64.memory_segments`, `start_file_address` for file offsets;
  CONTEXT offsets: Rip 0xF8, Rsp 0x98).
- **Prime daemon start:** `Start-Process` on the `.cmd` shim did nothing; a
  plain background `prime-agent --mode daemon` works. Killing the app leaves
  the daemon alone (good — it is the thing to keep running).
- **taskkill/paths:** this host disables MSYS path translation; use single
  slashes with native tools (`taskkill /PID n /F`).

## Tree state at handoff (HEAD `ff9909a`, nothing committed or pushed)

Mine (this session, uncommitted):
- `src-tauri/src/cli_agent_runtime/shell_env.rs` — cfg-gate Unix-only items
  (fixes 7 clippy dead-code errors on Windows).
- `src-tauri/src/commands/memory.rs` — same class, 2 items.
- `src-tauri/src/prime_session_host.rs` — deleted dead `#[cfg(not(unix))]
  current_uid` stub.
- `src-tauri/src/commands/ai.rs` — `ensure_prime_session_host` and
  `get_prime_session_host_status` converted to `async fn` (necessary, not
  sufficient — see hang3).

Not mine (pre-existing or from the app running):
- `M AGENTS.md`, `M README.md`, `M docs/plans/2026-09-27-cursor-swarm-plan.md`
  — were dirty at session start; left alone.
- `M src-tauri/Cargo.toml` — `git diff` is empty; line-ending phantom
  (autocrlf). Do not "fix" it blindly; check `git diff --stat` first.
- `M demo-vault-v2/AGENTS.md` — the app itself wrote this during boot
  (vault-skill seeding). Demo-vault dirt per the plan: revert before any
  commit unless the task owns it.
- Untracked: `.hermes/`, `DOpus-Noir-Themes.zip`, `docs/CHOPPING-BLOCK.md`,
  `docs/harness-field-guide*.{pdf,html}`, the plan file, one old handoff —
  pre-existing, left alone.

Plan tasks status: Tasks 0,2,3,6 done; Task 1 done (with the Build Tools
install + cfg fixes); Task 4 partially done (boots, then hangs — keep C42
OPEN); Task 5 not reached; Task 7 not run (`cargo test`, `llvm-cov`); Task 8
docs update not done (this file is the evidence so far); Task 9 no commit
yet. `pnpm handoff:check` should pass this file's shape.

## Addendum — reconnect loop (kill-time evidence, same session)

When the third hung app was force-killed, the `tauri dev` log tail showed a
hot reconnect loop: `Prime vault skill ready … / Connected to Prime daemon`
pairs every ~4 s (14:42:59, 14:43:03, 14:43:07, 14:43:11), each on the
`~\Documents\Rhizome Vault` cwd — a different vault from the
demo-vault-v2 boots. Something tears the host down right after a successful
connect and the status poll reconnects forever. Two failure modes therefore
coexist: (a) the main-thread pipe-write block, and (b) a reconnect loop that
re-seeds the vault skill each cycle (it wrote the demo-vault dirt). Check
`host.is_alive()` / the `OutboundLine::Closed` path and which vault the
window attaches to before trusting any single-cause theory.

