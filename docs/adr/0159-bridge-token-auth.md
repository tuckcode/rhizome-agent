---
type: ADR
id: "0159"
title: "Browser-extension clients authenticate to the tool bridge with a shared token"
status: active
date: 2026-07-25
---

## Context

The browser extension (`docs/plans/2026-07-25-browser-extension-plan.md`)
needs to reach the running desktop app. That plan states the transport was
"decided, already de-risked" and names `ws://localhost:9711`. Reading
`mcp-server/ws-bridge.js` shows the premise does not hold:

1. **9711 is not a tool bridge.** It is a broadcast relay — its
   `connection` handler rebroadcasts each message to the *other* clients
   (`ws-bridge.js`). There is no verb dispatch on it at all.
2. **9710, the tool bridge, rejected every browser client by design:**
   `if (bridgeType === 'tool' && origin) return { ok: false, reason:
   'browser origins are not allowed on the tool bridge' }`. A browser always
   sends `Origin`; Chrome sends `chrome-extension://<id>`.
3. **9711's allowlist would not have taken an extension either.**
   `isTrustedUiOrigin` permits the tauri origins and
   `http://localhost:<port>`. `chrome-extension://` matches neither.

The MV3 spike that cleared "the single biggest architectural unknown" tested
the *client*: can a service worker hold a WebSocket to localhost? It can.
Nobody tested whether this server accepts one. It did not.

The origin rejection on the tool bridge is a real control, not an oversight:
the tool bridge can read and write the user's vault, and without it any web
page's JavaScript could connect to `localhost:9710` and start calling vault
tools. Opening it needs a replacement control, not a deletion.

Two shapes were available.

## Decision

**A browser-extension origin may connect to the tool bridge, but cannot
dispatch any tool until it presents a shared secret the app generated.**
Origin alone is a filter, never the authorisation.

### The token

`settings::ensure_bridge_token()` returns a persisted 32-hex UUIDv4,
generating and saving one on first call. `mcp::spawn_ws_bridge_with_paths`
passes it to the bridge process as `RHIZOME_BRIDGE_TOKEN`. It is generated
once per install and stable across restarts, so an extension pairs once.

If the token cannot be resolved, the bridge still starts — the MCP stdio
server and the app connect without auth and must not be taken down by an
extension-only concern — but `BRIDGE_TOKEN` is empty and **every extension
client is refused**. An unconfigured bridge fails closed.

### The gate

Two pure functions, both unit-tested:

- `isBrowserExtensionOrigin(origin)` — `chrome-extension://`,
  `moz-extension://`, `safari-web-extension://`, bare host, no path.
  `evaluateBridgeRequest` uses it to let *only* those browser origins past
  the handshake; every other browser origin is rejected exactly as before.
- `evaluateToolMessage({ requiresAuth, authenticated, tool, token,
  expectedToken })` → `authenticate | reject | dispatch`. A connection from
  an extension origin has `requiresAuth: true` and can send exactly one
  thing until it authenticates: `bridge_auth` with the token.

Non-browser clients — the MCP stdio server, the app itself — send no
`Origin`, get `requiresAuth: false`, and dispatch exactly as before. This
adds a gate for the new client without changing the existing ones.

Page JavaScript cannot set an `Origin` header, so ordinary web content still
cannot get past `evaluateBridgeRequest`. The token defends against the
remaining case: a *different* extension the user installed, which can
present a genuine extension origin but cannot read the app's settings file.

## Options considered

- **Shared token, extension origins allowed to authenticate** (chosen):
  works identically in Chrome and Firefox, keeps the origin control intact
  for every other browser client, and the auth decision is a pure function
  that can be tested without standing up a socket. Costs one pairing step in
  the extension's options page.
- **Origin allowlist, no token**: pin `chrome-extension://<our-id>` and
  dispatch freely. No pairing friction, and a published extension's ID is
  stable and unforgeable by web content. But Firefox's `moz-extension://`
  host is a UUID regenerated **per installation**, so it cannot be
  hardcoded — Firefox would need the token anyway, leaving two auth models
  for one feature. It also grants full tool access on identity alone, so an
  unpacked/dev build of the extension has a different ID and silently stops
  working.
- **Per-connection handshake in the WebSocket subprotocol**: reject at the
  handshake rather than the first message, so an unauthenticated socket
  never exists. Genuinely tighter, but needs `handleProtocols` plumbing and
  moves the decision into `verifyClient` where it is harder to test in
  isolation. The window it closes is a socket from an extension origin on
  loopback that can send one message type — small enough not to buy the
  complexity yet.
- **Localhost HTTP endpoint with a token instead of WebSocket**: sidesteps
  the bridge entirely but adds a second server, a second port, and a second
  auth surface for the same job.

## Consequences

**Easier.** The extension has a supported way in that works in both target
browsers. The pairing step is a one-time paste, and the token is stable, so
it does not recur.

**Harder.** There is a setup step where there was none, and if the user
resets settings the extension must be re-paired. The token lives in
`settings.json` in plaintext — anything that can read that file can already
read the vault it points at, so this does not widen the blast radius, but it
does mean the token is not a secret from local processes.

**Deliberately not done here.** Token comparison is `===`, not
`crypto.timingSafeEqual`. The attacker would have to already be a locally
installed browser extension, and the token is 122 random bits; a timing
oracle over loopback is not the weak link. Revisit if the token ever becomes
reachable from a broader surface.

**Also not done here.** Nothing surfaces the token to the user yet — no
Settings UI — and no tool the extension needs is exposed on the bridge yet
(`rhizome_save_capture` lives in Rust behind `call_rhizome_tool`; reaching
it from `ws-bridge.js` follows the existing `RHIZOME_TOOL_PATH` sidecar
pattern). Those are the next two commits. Until then this is a gate with
nothing behind it, which is the correct order: build the lock before the
door.

**Re-evaluate if** a second non-extension browser client appears (the auth
model assumes "extension or trusted internal"), or if pairing friction shows
up as a real drop-off in extension activation.
