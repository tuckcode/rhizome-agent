#!/usr/bin/env node
/**
 * WebSocket bridge for Tolaria MCP tools.
 *
 * Exposes vault operations over WebSocket so the Tolaria app frontend
 * can invoke MCP tools in real-time without going through stdio.
 *
 * Port 9710: Tool bridge — Claude/AI clients call vault tools here.
 * Port 9711: UI bridge — Frontend listens for UI action broadcasts.
 *
 * Usage:
 *   VAULT_PATH=/path/to/vault WS_PORT=9710 WS_UI_PORT=9711 node ws-bridge.js
 *
 * Protocol (tool bridge):
 *   Client sends:  { "id": "req-1", "tool": "search_notes", "args": { "query": "test" } }
 *   Server sends:  { "id": "req-1", "result": { ... } }
 *   On error:      { "id": "req-1", "error": "message" }
 *
 * Protocol (UI bridge):
 *   Server broadcasts: { "type": "ui_action", "action": "open_note", "path": "..." }
 */
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { createMcpToolService } from './tool-service.js'

const WS_PORT = parseInt(process.env.WS_PORT || '9710', 10)
const WS_UI_PORT = parseInt(process.env.WS_UI_PORT || '9711', 10)
const LOOPBACK_HOST = 'localhost'
const TRUSTED_UI_ORIGINS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
])

/**
 * Shared secret the desktop app generates once per install and passes in when
 * it spawns this process. A browser extension must present it before it can
 * call any tool. Empty means the app did not configure one, and every
 * extension client is refused — an unconfigured bridge fails closed.
 */
const BRIDGE_TOKEN = process.env.RHIZOME_BRIDGE_TOKEN || ''

/** Tool name a browser-extension client sends to present its token. */
export const BRIDGE_AUTH_TOOL = 'bridge_auth'

/** `chrome-extension://<id>` and friends. Bare host, no path. */
const BROWSER_EXTENSION_ORIGIN = /^(?:chrome|moz|safari-web)-extension:\/\/[^/]+$/u

/** @type {WebSocketServer | null} */
let uiBridge = null
const UNKNOWN_TOOL = Symbol('unknown tool')

function broadcastUiAction(action, payload) {
  if (!uiBridge) return
  const msg = JSON.stringify({ type: 'ui_action', action, ...payload })
  for (const client of uiBridge.clients) {
    if (client.readyState === 1) client.send(msg)
  }
}

const toolService = createMcpToolService({ emitUiAction: broadcastUiAction })

async function readNoteTool(args) {
  const note = await toolService.readNote(args)
  return { content: note.content, frontmatter: note.frontmatter }
}

function uiOpenNoteTool(args) {
  toolService.openNoteInEditor(args)
  return { ok: true }
}

function uiOpenTabTool(args) {
  toolService.openNoteAsTab(args)
  return { ok: true }
}

async function createNoteTool(args = {}) {
  return { ok: true, ...(await toolService.createNote(args)) }
}

function highlightTool(args) {
  toolService.highlightEditor(args)
  return { ok: true }
}

function uiSetFilterTool(args) {
  toolService.setFilter(args)
  return { ok: true }
}

function refreshVaultTool(args) {
  toolService.refreshVault(args)
  return { ok: true }
}

/**
 * Path to the `rhizome-tool` Rust sidecar, set by the app when it spawns this
 * process. Unset means the save-capture verb is unavailable rather than
 * silently doing something else.
 */
const RHIZOME_TOOL_PATH = process.env.RHIZOME_TOOL_PATH || ''

/**
 * argv for `rhizome-tool save-capture`. An array, never a shell string
 * (ADR-0152), so a source or title containing spaces, quotes, or a leading
 * dash stays one argument instead of becoming new flags.
 */
export function buildSaveCaptureArgs(vaultPath, args = {}) {
  const { source, title, context, text } = args
  if (typeof source !== 'string' || !source) {
    throw new Error('save-capture requires a source')
  }
  const argv = ['save-capture', vaultPath, source]
  for (const [flag, value] of [['--title', title], ['--context', context], ['--text', text]]) {
    if (typeof value === 'string' && value) argv.push(flag, value)
  }
  // The bridge only ever reaches this verb from an authenticated browser
  // extension, so the trigger is not the caller's to choose.
  argv.push('--trigger', 'browser_extension')
  return argv
}

/** The one active vault this call may write to, or an error string. */
function resolveWritableVault(args) {
  const vaultPath = typeof args.vaultPath === 'string'
    ? args.vaultPath
    : toolService.activeVaultPaths()[0]
  if (args.vaultPath && !toolService.activeVaultPaths().includes(args.vaultPath)) {
    return { error: 'Vault path is not active' }
  }
  if (!vaultPath) return { error: 'No active vault' }
  return { vaultPath }
}

const TOOL_EXECUTORS = [
  ['open_note', readNoteTool],
  ['read_note', readNoteTool],
  ['create_note', createNoteTool],
  ['search_notes', (args) => toolService.searchNotes(args)],
  ['vault_context', (args) => toolService.vaultContext(args)],
  ['list_vaults', () => toolService.listVaults()],
  ['ui_open_note', uiOpenNoteTool],
  ['ui_open_tab', uiOpenTabTool],
  ['ui_highlight', highlightTool],
  ['highlight_editor', highlightTool],
  ['ui_set_filter', uiSetFilterTool],
  ['refresh_vault', refreshVaultTool],
  ['show_confetti', (args) => toolService.showConfetti(args)],
  ['rhizome_search', (args) => toolService.searchNotes(args)],
  ['rhizome_lint', async (args) => {
    const { execFileSync } = await import('node:child_process')
    const vaultPath = typeof args.vaultPath === 'string'
      ? args.vaultPath
      : toolService.activeVaultPaths()[0]
    if (args.vaultPath && !toolService.activeVaultPaths().includes(args.vaultPath)) {
      return { error: 'Vault path is not active' }
    }
    if (!vaultPath) return { error: 'No active vault' }
    // argv array — never shell-join (path/arg injection)
    const out = execFileSync('rhizome-lint', [vaultPath, '--format', 'text'], {
      encoding: 'utf-8',
      timeout: 30000,
    })
    return { result: out }
  }],
  ['rhizome_save_capture', async (args) => {
    const { execFileSync } = await import('node:child_process')
    if (!RHIZOME_TOOL_PATH) return { error: 'rhizome-tool is not available' }
    const resolved = resolveWritableVault(args)
    if (resolved.error) return resolved
    // argv array — never shell-join (path/arg injection)
    const out = execFileSync(RHIZOME_TOOL_PATH, buildSaveCaptureArgs(resolved.vaultPath, args), {
      encoding: 'utf-8',
      timeout: 30000,
    })
    return { result: out.trim() }
  }],
  ['rhizome_graph_summary', async (args) => {
    const { execFileSync } = await import('node:child_process')
    const vaultPath = typeof args.vaultPath === 'string'
      ? args.vaultPath
      : toolService.activeVaultPaths()[0]
    if (args.vaultPath && !toolService.activeVaultPaths().includes(args.vaultPath)) {
      return { error: 'Vault path is not active' }
    }
    if (!vaultPath) return { error: 'No active vault' }
    const out = execFileSync('rhizome-graph', ['summary', vaultPath], {
      encoding: 'utf-8',
      timeout: 30000,
    })
    return { result: out }
  }],
]

function callToolHandler(tool, args) {
  const executor = TOOL_EXECUTORS.find(([name]) => name === tool)?.[1]
  return executor ? executor(args) : UNKNOWN_TOOL
}

async function handleMessage(data, session = { requiresAuth: false, authenticated: false }) {
  const msg = JSON.parse(data)
  const { id, tool, args } = msg

  const verdict = evaluateToolMessage({
    requiresAuth: session.requiresAuth,
    authenticated: session.authenticated,
    tool,
    token: args?.token,
    expectedToken: BRIDGE_TOKEN,
  })
  if (verdict.action === 'reject') {
    return { id, error: verdict.reason }
  }
  if (verdict.action === 'authenticate') {
    session.authenticated = true
    return { id, result: { ok: true } }
  }

  try {
    const result = await callToolHandler(tool, args || {})
    if (result === UNKNOWN_TOOL) {
      return { id, error: `Unknown tool: ${tool}` }
    }
    return { id, result }
  } catch (err) {
    return { id, error: err.message }
  }
}

export function isLoopbackAddress(remoteAddress) {
  return remoteAddress === '127.0.0.1'
    || remoteAddress === '::1'
    || remoteAddress === '::ffff:127.0.0.1'
}

export function isTrustedUiOrigin(origin) {
  if (!origin) return true
  if (TRUSTED_UI_ORIGINS.has(origin)) return true
  return /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/u.test(origin)
}

export function isBrowserExtensionOrigin(origin) {
  return typeof origin === 'string' && BROWSER_EXTENSION_ORIGIN.test(origin)
}

export function evaluateBridgeRequest({ bridgeType, origin, remoteAddress }) {
  if (!isLoopbackAddress(remoteAddress)) {
    return { ok: false, reason: 'non-local client' }
  }

  // A browser extension is the one browser client allowed onto the tool
  // bridge, and only far enough to authenticate — `evaluateToolMessage`
  // refuses to dispatch anything until it presents the shared token. Page
  // JavaScript cannot forge an Origin header, so ordinary web content still
  // cannot reach vault tools.
  if (bridgeType === 'tool' && origin && !isBrowserExtensionOrigin(origin)) {
    return { ok: false, reason: 'browser origins are not allowed on the tool bridge' }
  }

  if (bridgeType === 'ui' && !isTrustedUiOrigin(origin)) {
    return { ok: false, reason: 'untrusted UI origin' }
  }

  return { ok: true, reason: null }
}

/**
 * Decide what to do with one tool message from a tool-bridge client.
 *
 * `requiresAuth` is true for browser-extension clients only. The MCP stdio
 * server and the app itself connect without an Origin and keep dispatching
 * exactly as before, so this adds a gate for the new client without changing
 * the existing ones.
 *
 * @returns {{action: 'authenticate' | 'reject' | 'dispatch', reason: string | null}}
 */
export function evaluateToolMessage({ requiresAuth, authenticated, tool, token, expectedToken }) {
  if (tool === BRIDGE_AUTH_TOOL) {
    if (!expectedToken) {
      return { action: 'reject', reason: 'bridge token not configured' }
    }
    if (token !== expectedToken) {
      return { action: 'reject', reason: 'invalid bridge token' }
    }
    return { action: 'authenticate', reason: null }
  }

  if (requiresAuth && !authenticated) {
    return { action: 'reject', reason: 'bridge client is not authenticated' }
  }

  return { action: 'dispatch', reason: null }
}

function verifyBridgeRequest(bridgeType) {
  return (info, done) => {
    const verdict = evaluateBridgeRequest({
      bridgeType,
      origin: info.origin,
      remoteAddress: info.req.socket.remoteAddress,
    })

    if (!verdict.ok) {
      console.error(`[ws-bridge] Rejected ${bridgeType} bridge client: ${verdict.reason}`)
      done(false, 403, 'Forbidden')
      return
    }

    done(true)
  }
}

/**
 * Attempt to start the UI bridge WebSocket server.
 * Returns a Promise that resolves to the WebSocketServer or null if the port
 * is unavailable (e.g. another Tolaria instance owns it).
 */
export function startUiBridge(port = WS_UI_PORT) {
  return new Promise((resolve) => {
    const httpServer = createServer()

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ws-bridge] UI bridge port ${port} already in use, disabling bridge`)
      } else {
        console.error(`[ws-bridge] UI bridge error: ${err.message}`)
      }
      resolve(null)
    })

    httpServer.listen(port, LOOPBACK_HOST, () => {
      const wss = new WebSocketServer({
        server: httpServer,
        verifyClient: verifyBridgeRequest('ui'),
      })
      wss.on('connection', (ws) => {
        console.error(`[ws-bridge] UI client connected on port ${port}`)
        // Relay: when a client sends a message, broadcast to all OTHER clients.
        // This allows the MCP stdio server (connected as a client) to reach the frontend.
        ws.on('message', (raw) => {
          for (const client of wss.clients) {
            if (client !== ws && client.readyState === 1) client.send(raw.toString())
          }
        })
      })
      uiBridge = wss
      console.error(`[ws-bridge] UI bridge listening on ws://localhost:${port}`)
      resolve(wss)
    })
  })
}

export function startBridge(port = WS_PORT) {
  const currentVaultPaths = toolService.activeVaultPaths()
  const wss = new WebSocketServer({
    port,
    host: LOOPBACK_HOST,
    verifyClient: verifyBridgeRequest('tool'),
  })

  wss.on('connection', (ws, req) => {
    // Per-connection auth state. A browser extension gets in far enough to
    // send `bridge_auth` and nothing else until it does; every other client
    // (MCP stdio server, the app) is unchanged.
    const session = {
      requiresAuth: isBrowserExtensionOrigin(req?.headers?.origin),
      authenticated: false,
    }
    console.error(
      `[ws-bridge] Client connected (vaults: ${currentVaultPaths.join(', ')}`
      + `${session.requiresAuth ? ', awaiting extension auth' : ''})`,
    )

    ws.on('message', async (raw) => {
      try {
        const response = await handleMessage(raw.toString(), session)
        ws.send(JSON.stringify(response))
      } catch (err) {
        ws.send(JSON.stringify({ error: `Parse error: ${err.message}` }))
      }
    })

    ws.on('close', () => console.error('[ws-bridge] Client disconnected'))
  })

  console.error(`[ws-bridge] Listening on ws://${LOOPBACK_HOST}:${port}`)
  return wss
}

// Run directly if invoked as main module
const isMain = process.argv[1]?.endsWith('ws-bridge.js')
if (isMain) {
  try {
    toolService.activeVaultPaths()
    startUiBridge().then(() => startBridge())
  } catch (err) {
    console.error(`[ws-bridge] ${err.message}`)
    process.exit(1)
  }
}
