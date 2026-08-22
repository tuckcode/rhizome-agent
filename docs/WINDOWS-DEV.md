# Windows development — Rhizome Agent + Prime

Rhizome Agent is a **first-class Windows app** (Tauri + WebView2). Notes,
editor, search, git, wiki, and MCP all work on Windows. Prime chat/sessions
need the **`prime-agent` daemon** running on the same machine.

## One-time prerequisites

1. **Node.js 20+** — https://nodejs.org/
2. **pnpm** — `npm i -g pnpm`
3. **Rust** — https://rustup.rs/ (default `stable`, MSVC toolchain)
4. **Visual Studio Build Tools** — “Desktop development with C++” workload
   (needed for `cargo` / Tauri on Windows)
5. **WebView2** — usually already on Windows 10/11; Tauri will prompt if not

For **pre-push Rust coverage** (only if you push from this machine):

```powershell
rustup component add llvm-tools-preview
```

Do **not** set `LLVM_COV` / `LLVM_PROFDATA` from the macOS `brew` instructions
in `AGENTS.md` — Windows finds llvm-tools via rustup.

## Get the repo

```powershell
git clone https://github.com/tuckcode/rhizome-agent.git
cd rhizome-agent
git pull origin main
```

You need **`1922a27` or later** (`feat: connect Prime daemon over Windows named
pipe (#32)`). Check:

```powershell
git log -1 --oneline
```

## Install JS + Prime CLI

```powershell
pnpm install
npm i -g prime-agent
prime-agent --version
```

`0.7.1+` required (`0.7.4` probed in handoff).

## Start Prime daemon (required for chat / sessions)

The daemon must stay running while you use Prime features. Start it detached:

```powershell
Start-Process prime-agent -ArgumentList "--mode","daemon" -WindowStyle Hidden
Start-Sleep -Seconds 2
prime-agent status
```

Look for a line containing `\\.\pipe\prime-agent-daemon` (may show a `*`
marker for the default service — that is display only, not part of the path).

If status fails, the CLI is not on `PATH` — reopen the terminal after
`npm i -g`, or use the full path under `%APPDATA%\npm\prime-agent.cmd`.

## Run Rhizome

```powershell
pnpm tauri dev
```

First compile can take several minutes (Rust + frontend).

### UI-only without a daemon

```powershell
pnpm dev
```

Uses `mock-tauri` — session list UI works without Prime.

## Troubleshooting Prime on Windows

| Symptom | Fix |
|--------|-----|
| “Prime not installed” | `npm i -g prime-agent`, restart terminal |
| “Service unreachable” | Start daemon (see above); `prime-agent status` |
| Wrong pipe | `$env:RHIZOME_PRIME_DAEMON_SOCKET='\\.\pipe\prime-agent-daemon'` then retry |
| App builds but Prime panel empty | Open a vault first; attach creates a session |

## Build a Windows installer (optional)

```powershell
pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis
```

Output under `src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\`.
