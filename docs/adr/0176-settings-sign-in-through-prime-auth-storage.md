---
type: ADR
id: "0176"
title: "Settings sign-in drives Prime's own AuthStorage"
status: active
date: 2026-10-03
---

**Origin:** Claude Opus 5.5 · 2026-10-03 · Claude Code desktop, Windows

## Context

Settings → Providers could only copy `prime-agent --provider <name>` to the
clipboard. The user then had to open a terminal, start the TUI and run
`/login`. Atticus asked for Sign in to open the browser directly (C85).

Prime's daemon has no auth command. Its login code lives in the installed
package: `AuthStorage.login(provider, callbacks)` runs the OAuth flow
(PKCE, local callback server on port 53692) and writes `~/.prime/agent/auth.json`
under Prime's own file lock. `AuthStorage.set(provider, { type: "api_key" })`
stores a key the same way.

[ADR-0168](0168-selective-harness-doctrine.md) rejects a second credential
store. Writing `auth.json` from Rust would be one in all but name: a second
writer of Prime's format, without Prime's lock.

## Decision

**Rhizome signs in by running Prime's own code, not by writing Prime's file.**

`mcp-server/prime-login.mjs` imports `AuthStorage` from the installed
`prime-agent` package (`PRIME_AGENT_PACKAGE_DIR`, resolved from the binary)
and calls `login` or `set`. It reports one JSON event per line;
`src-tauri/src/prime_login.rs` opens the `open_url` page in the system browser
and returns on `done` or `error`. Afterwards the attached session is reloaded,
which re-reads `auth.json`.

- Browser sign-in for any provider Prime has OAuth for: Anthropic,
  ChatGPT (OpenAI Codex), GitHub Copilot, plus any a user extension adds.
  The helper loads the user's Prime extensions first, as a session does, so
  `~/.prime/agent/extensions/xai-oauth.ts` gives xAI its browser login.
  Without that extension, xAI Sign in reports that Prime has no browser
  sign-in for it; it never falls back to asking for a key.
- Key providers with a known key page (DeepSeek) open that page and take the
  pasted key in Settings. The key goes to the helper on stdin, never argv.

## Consequences

- No terminal for the common providers.
- Rhizome depends on `AuthStorage` staying exported from `prime-agent`'s
  entry point. A Prime release that renames it breaks Sign in with an error
  from the helper; nothing else is affected.
- One login at a time: a second click kills the first helper, which frees
  the callback port. An abandoned login times out after 5 minutes.
- GitHub Copilot's device-code flow shows its code only in `onAuth`
  instructions, which Settings does not display yet.
