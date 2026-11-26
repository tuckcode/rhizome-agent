# Windows development

> **⚠️ Status, corrected 2026-08-22: the app has never been launched on
> Windows.** Not "the daemon does not connect yet" — nobody has observed
> Rhizome start on a Windows machine at all. Everything below is the
> intended setup path, not a verified one, and the first person to run it
> should expect to be debugging the boot, not the features.
>
> This file previously opened by calling Rhizome Agent "a first-class
> Windows app" whose notes, editor, search, git, wiki and MCP "all work on
> Windows". No one had checked any of that. It was written from what the
> code is *meant* to do. See C42.
>
> **Stamped 16:05:** still no Windows work this window. C42 stays skip.

Rhizome **targets** Windows (Tauri + WebView2). Chat runs on Rhizome's own
engine (ADR-0187), so no outside daemon is needed. Prime is no longer part of
Rhizome (ADR-0189).

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

## Install packages

```powershell
pnpm install
```

## Run Rhizome

```powershell
pnpm tauri dev
```

First compile can take several minutes (Rust + frontend).

### Interface only

```powershell
pnpm dev
```

Uses `mock-tauri`, so the interface runs without the Rust backend.

## Build a Windows installer (optional)

```powershell
pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis
```

Output under `src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\`.

## Vault tools in a packaged Windows build (C69)

`pnpm tauri build` runs `pnpm bundle-mcp`, which must put `cli-call.mjs`
next to `index.js` under the app’s `resources/mcp-server/`. Without it,
skill seeding fails and graph/vault tools stay broken for agents — same
bug as macOS. The installer must ship `rhizome-tool.exe` beside the main
exe so `RHIZOME_TOOL_PATH` can be embedded in the seeded skill. Prefer the
packaged `resources/mcp-server` over a leftover git checkout on the same
machine (`pick_mcp_server_dir`). Unverified on a real Windows box (C42).
