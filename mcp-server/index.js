#!/usr/bin/env node
/**
 * Rhizome MCP Server — vault and research tools for AI agents.
 *
 * These MCP tools provide Rhizome-specific capabilities alongside each
 * app-managed agent's own Safe / Power User permission profile:
 *
 *   - search_notes: full-text search across vault notes
 *   - get_vault_context: vault structure overview (types, note count, folders)
 *   - get_note: parsed frontmatter + content (convenience over raw cat)
 *   - create_note: create a new markdown note without overwriting existing files
 *   - open_note: signal Rhizome UI to open a note as a tab
 *   - highlight_editor: visually highlight a UI element (editor, tab, etc.)
 *   - refresh_vault: trigger vault rescan so new/modified files appear
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import WebSocket from 'ws'
import { createMcpToolService } from './tool-service.js'
import { appendRhizomeEvent } from './vault-events.js'

/**
 * Resolve vault path from MCP args, rejecting paths not in the active vault set.
 * This is the vault-boundary gate every handler MUST call.
 * throws if args.vaultPath is set but not an active/configured vault root.
 */
function resolveVaultPath(args = {}, toolService) {
  const active = toolService.activeVaultPaths()
  if (args.vaultPath) {
    toolService.requestedVaultPath(args) // throws on mismatch
    return args.vaultPath
  }
  if (active && active.length > 0) return active[0]
  throw new Error('No active vault available')
}

const WS_UI_PORT = parseInt(process.env.WS_UI_PORT || '9711', 10)
const WS_UI_URL = `ws://localhost:${WS_UI_PORT}`
// ADR-0152 / MCP bridge Phase 2: when set, the six research verbs below
// call the `rhizome-tool` Rust sidecar instead of shelling the Python
// `rhizome-*` CLIs. Unset by default — Python remains the zero-risk path
// until Phase 3 packages the binary via Tauri `externalBin`.
const RHIZOME_TOOL_PATH = process.env.RHIZOME_TOOL_PATH || null
const LOCAL_READ_ONLY_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
})
const LOCAL_CREATE_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
})

// Connect as a WebSocket CLIENT to the UI bridge (run by ws-bridge.js).
// The bridge relays messages to all other clients (the React frontend).
let uiSocket = null
let reconnectTimer = null
let shutdownStarted = false
const RECONNECT_INTERVAL_MS = 3000

function connectUiBridge() {
  if (shutdownStarted) return

  try {
    const ws = new WebSocket(WS_UI_URL)
    uiSocket = ws
    ws.on('open', () => {
      if (shutdownStarted) {
        closeUiSocket()
        return
      }
      console.error(`[mcp] Connected to UI bridge at ${WS_UI_URL}`)
    })
    ws.on('close', () => {
      if (uiSocket === ws) uiSocket = null
      scheduleUiReconnect()
    })
    ws.on('error', () => {
      // Silent — bridge may not be running yet, will retry
    })
  } catch {
    scheduleUiReconnect()
  }
}

function scheduleUiReconnect() {
  if (shutdownStarted) return

  clearUiReconnectTimer()
  reconnectTimer = setTimeout(connectUiBridge, RECONNECT_INTERVAL_MS)
  reconnectTimer.unref?.()
}

function clearUiReconnectTimer() {
  if (!reconnectTimer) return

  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function closeUiSocket() {
  const socket = uiSocket
  uiSocket = null
  if (!socket) return

  socket.removeAllListeners()
  socket.on('error', () => {})
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.terminate?.()
    return
  }

  try {
    socket.close()
  } catch {
    // Ignore close races during process teardown.
  }
  socket.terminate?.()
}

function broadcastUiAction(action, payload) {
  if (!uiSocket || uiSocket.readyState !== WebSocket.OPEN) return
  uiSocket.send(JSON.stringify({ type: 'ui_action', action, ...payload }))
}

const toolService = createMcpToolService({ emitUiAction: broadcastUiAction })

const TOOLS = [
  {
    name: 'search_notes',
    description: 'Full-text search across vault notes by title or content. Returns matching paths, titles, and snippets.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_vault_context',
    description: 'Get vault orientation for the active Rhizome vaults: entity types, AGENTS.md instructions, note count, folders, and recent notes.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: { type: 'string', description: 'Optional target vault root. Omit to inspect all active vaults.' },
      },
    },
  },
  {
    name: 'list_vaults',
    description: 'List the current active Rhizome vaults available to MCP tools, including whether each vault has AGENTS.md instructions.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_note',
    description: 'Read a note with parsed YAML frontmatter and markdown content. Returns {path, frontmatter, content}.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note (e.g. "project/my-project.md")' },
        vaultPath: { type: 'string', description: 'Optional target vault root when multiple vaults are active.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new markdown note inside an active Rhizome vault. Does not overwrite existing files. Use content for the full markdown including YAML frontmatter and H1.',
    annotations: LOCAL_CREATE_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the vault, or an absolute path inside an active vault. Must end in .md.' },
        content: { type: 'string', description: 'Full markdown note content, including YAML frontmatter when needed.' },
        title: { type: 'string', description: 'Optional title used only when content is omitted.' },
        type: { type: 'string', description: 'Optional note type used only when content is omitted.' },
        is_a: { type: 'string', description: 'Legacy alias for type, used only when content is omitted.' },
        vaultPath: { type: 'string', description: 'Optional target vault root when multiple vaults are active.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'open_note',
    description: 'Open a note in the Rhizome UI as a new tab. Use after creating or editing a note so the user can see it.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
        vaultPath: { type: 'string', description: 'Optional target vault root when opening a note outside the default vault.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'highlight_editor',
    description: 'Visually highlight a UI element in Rhizome (editor, tab, properties panel, or note list). The highlight auto-clears after a short delay.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        element: { type: 'string', enum: ['editor', 'tab', 'properties', 'notelist'], description: 'Which UI element to highlight' },
        path: { type: 'string', description: 'Optional note path to associate with the highlight' },
      },
      required: ['element'],
    },
  },
  {
    name: 'refresh_vault',
    description: 'Trigger a vault rescan so new or modified files appear immediately in the Rhizome note list.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Optional specific note path that changed' },
        vaultPath: { type: 'string', description: 'Optional target vault root when refreshing a note outside the default vault.' },
      },
    },
  },
  {
    name: 'rhizome_search',
    description: 'Search the Rhizome vault wiki using rhizome-search CLI for relevant wiki pages, entities, concepts, and research queries.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
        vaultPath: { type: 'string', description: 'Optional target vault root. Uses active vault if omitted.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'rhizome_lint',
    description: 'Run structural lint on the Rhizome vault: broken wikilinks, orphan pages, missing frontmatter.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: { type: 'string', description: 'Optional target vault root. Uses active vault if omitted.' },
      },
    },
  },
  {
    name: 'rhizome_graph_summary',
    description: 'Get a summary of the wikilink graph: page count, edge count, communities, and most-connected pages.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: { type: 'string', description: 'Optional target vault root. Uses active vault if omitted.' },
      },
    },
  },
  {
    name: 'rhizome_repo_research',
    description: 'Research a GitHub repository or local codebase and generate one or more wiki pages in the Rhizome vault. Uses the specified research mode (architecture, hidden-lessons, reusable-patterns, first-hour, agent-handoff, integration-plan). Specify pageCount for multi-page output.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'GitHub URL (github.com/owner/repo) or local path to the repository' },
        mode: { type: 'string', description: 'Research mode (default: architecture)', enum: ['architecture', 'hidden-lessons', 'reusable-patterns', 'first-hour', 'agent-handoff', 'integration-plan', 'feature-scout', 'mental-model'] },
        depth: { type: 'string', description: 'Research depth: fast (3-5 pages), regular (8-18 pages), deep (25+ pages) (default: fast)', enum: ['fast', 'regular', 'deep'] },
        vaultPath: { type: 'string', description: 'Optional target vault root. Uses active vault if omitted.' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'rhizome_generate_wiki',
    description: 'Full Grok-Wiki-style wiki generation: explore a repo, plan a structure, then generate multiple organized wiki pages into sources/repos/<slug>/ within the Rhizome vault.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'GitHub URL (github.com/owner/repo) or local path to the repository' },
        mode: { type: 'string', description: 'Research mode (default: architecture)', enum: ['architecture', 'hidden-lessons', 'reusable-patterns', 'first-hour', 'agent-handoff', 'integration-plan', 'feature-scout', 'mental-model'] },
        depth: { type: 'string', description: 'Depth: fast (3-5 pages), regular (8-18), deep (25+) (default: fast)', enum: ['fast', 'regular', 'deep'] },
        pageCount: { type: 'number', description: 'Exact number of pages (overrides depth auto-count)' },
        vaultPath: { type: 'string', description: 'Optional target vault root' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'rhizome_grok_import',
    description: 'Import Grok-Wiki generated JSON files into the Rhizome vault as structured markdown wiki pages under sources/repos/<owner>-<repo>/. Use --list to discover available Grok-Wiki wikis.',
    annotations: LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to a specific Grok-Wiki JSON file. Omit to scan default Grok-Wiki data directory.' },
        listOnly: { type: 'boolean', description: 'If true, list available Grok-Wiki wikis without importing.' },
        vaultPath: { type: 'string', description: 'Optional target vault root.' },
      },
    },
  },
  {
    name: 'rhizome_import_source',
    description: 'Import a document (PDF, web URL, YouTube video, or text file) into the Rhizome vault. Extracts text content and writes as a structured markdown page under sources/documents/ or projects/<name>/sources/.',
    annotations: LOCAL_CREATE_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'File path (PDF, .md, .txt), web URL, or YouTube URL' },
        project: { type: 'string', description: 'Optional project/notebook name to organize imports under projects/<name>/sources/' },
        vaultPath: { type: 'string', description: 'Optional target vault root.' },
      },
      required: ['source'],
    },
  },
  {
    name: 'rhizome_distill',
    description: 'Distill research output or source text into structured knowledge cards (concept, architecture-pattern, workflow, integration, failure-mode, convention). Cards are written to entities/ or concepts/ in the vault.',
    annotations: LOCAL_CREATE_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Path to a file containing source text to distill' },
        text: { type: 'string', description: 'Inline text to distill into cards' },
        project: { type: 'string', description: 'Optional project name to organize cards under projects/<name>/entities/' },
        kind: { type: 'string', description: 'Force all cards to this kind', enum: ['concept', 'architecture-pattern', 'workflow', 'integration', 'failure-mode', 'convention'] },
        listKinds: { type: 'boolean', description: 'List available card kinds' },
        vaultPath: { type: 'string', description: 'Optional target vault root.' },
      },
    },
  },
]

async function handleSearchNotes(args) {
  const results = await toolService.searchNotes(args)
  const text = results.length === 0
    ? 'No matching notes found.'
    : results.map(r => `**${r.title}** (${r.vaultLabel} / ${r.path})\n${r.snippet}`).join('\n\n')
  return { content: [{ type: 'text', text }] }
}

async function handleVaultContext(args = {}) {
  const ctx = await toolService.vaultContext(args)
  return { content: [{ type: 'text', text: JSON.stringify(ctx, null, 2) }] }
}

async function handleListVaults() {
  return { content: [{ type: 'text', text: JSON.stringify(await toolService.listVaults(), null, 2) }] }
}

async function handleGetNote(args) {
  const note = await toolService.readNote(args)
  return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] }
}

async function handleCreateNote(args = {}) {
  const note = await toolService.createNote(args)
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(note, null, 2),
    }],
  }
}

function handleOpenNote(args) {
  // Refresh vault first so the new/modified note appears in the note list,
  // then signal the UI to open it in a tab.
  const { targetPath } = toolService.openNoteAsTab(args)
  return { content: [{ type: 'text', text: `Opening ${targetPath} in Rhizome` }] }
}

function handleHighlightEditor(args) {
  toolService.highlightEditor(args)
  return { content: [{ type: 'text', text: `Highlighting ${args.element}` }] }
}

function handleRefreshVault(args) {
  toolService.refreshVault(args)
  return { content: [{ type: 'text', text: 'Vault refresh triggered' }] }
}

// appendRhizomeEvent now lives in ./vault-events.js — see ADR-0161. It was
// moved out so it is testable at all (importing index.js starts the server)
// and so every record it writes carries a `trigger`, which none of the ten
// call sites below used to supply.

/**
 * Pick the Python CLI or the `rhizome-tool` Rust sidecar for a verb.
 * `pythonArgs`/`rustArgs` are already-built argv arrays for each side —
 * the two binaries take different shapes, so callers build both and let
 * this pick which one actually runs.
 */
function resolveRhizoTarget(pythonBin, pythonArgs, rustSubcommand, rustArgs) {
  return RHIZOME_TOOL_PATH
    ? { bin: RHIZOME_TOOL_PATH, args: [rustSubcommand, ...rustArgs], isRust: true }
    : { bin: pythonBin, args: pythonArgs, isRust: false }
}

async function handleRhizomeSearch(args) {
  const vaultPath = resolveVaultPath(args, toolService)
  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 10
  const target = resolveRhizoTarget(
    'rhizome-search',
    [vaultPath, args.query, '-k', String(limit), '--format', 'json'],
    'search',
    [vaultPath, args.query, '--limit', String(limit)],
  )
  const output = await runRhizoCli(target.bin, target.args, 15000)
  try {
    const parsed = JSON.parse(output)
    // Rust hits are {path, title, snippet} (rhizome_api::AskResultDto);
    // Python hits are {page, score} — different shapes, same contract.
    const formatHit = target.isRust
      ? (r, i) => `${i + 1}. [[${r.path}]] — ${r.title}${r.snippet ? `: ${r.snippet}` : ''}`
      : (r, i) => `${i + 1}. [[${r.page}]] (score: ${r.score.toFixed(2)})`
    const text = Array.isArray(parsed) && parsed.length > 0
      ? parsed.map(formatHit).join('\n')
      : 'No matching wiki pages found.'
    appendRhizomeEvent(vaultPath, { type: 'search', query: args.query, results: parsed?.length || 0 })
    return { content: [{ type: 'text', text }] }
  } catch {
    return { content: [{ type: 'text', text: output }] }
  }
}

/**
 * Run a rhizome CLI binary with an argv array (never a shell string).
 * `file` is the executable name/path; `args` are discrete argv entries.
 * Avoids shell metacharacter injection via vault paths / tool args.
 */
async function runRhizoCli(file, args, timeout = 30000) {
  const { execFileSync } = await import('node:child_process')
  if (typeof file !== 'string' || !file) {
    throw new Error('runRhizoCli requires an executable path/name')
  }
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    throw new Error('runRhizoCli requires a string argv array')
  }
  return execFileSync(file, args, {
    encoding: 'utf-8',
    timeout,
    maxBuffer: 1024 * 1024,
  })
}

async function handleRhizomeLint(args) {
  const vaultPath = resolveVaultPath(args, toolService)
  const output = await runRhizoCli('rhizome-lint', [vaultPath, '--format', 'text'], 30000)
  appendRhizomeEvent(vaultPath, { type: 'lint', result: output?.length || 0 })
  return { content: [{ type: 'text', text: output || 'No lint issues found.' }] }
}

async function handleRhizomeGraphSummary(args) {
  const vaultPath = resolveVaultPath(args, toolService)
  const output = await runRhizoCli('rhizome-graph', ['summary', vaultPath], 30000)
  appendRhizomeEvent(vaultPath, { type: 'graph-summary' })
  return { content: [{ type: 'text', text: output || 'Graph summary generated.' }] }
}

async function handleRhizomeRepoResearch(args) {
  const vaultPath = resolveVaultPath(args, toolService)
  const repo = typeof args.repo === 'string' ? args.repo.trim() : ''
  if (!repo) throw new Error('Repository or path is required')
  const mode = typeof args.mode === 'string' ? args.mode.trim() : 'architecture'
  const depth = typeof args.depth === 'string' ? args.depth.trim() : 'fast'
  const rounds = depth === 'deep' ? 3 : depth === 'regular' ? 2 : 1
  const target = resolveRhizoTarget(
    'rhizome-research',
    [vaultPath, repo, '--rounds', String(rounds)],
    'repo-research',
    [vaultPath, repo, '--mode', mode, '--depth', depth],
  )
  // rhizome_api::repo_research already appends its own .rhizome/events.jsonl
  // entry — skip the JS-side event on the Rust path to avoid double-logging.
  if (!target.isRust) appendRhizomeEvent(vaultPath, { type: 'research-started', mode, repo, depth })
  const output = await runRhizoCli(target.bin, target.args, 120000)
  if (!target.isRust) appendRhizomeEvent(vaultPath, { type: 'research-finished', mode, repo })
  return { content: [{ type: 'text', text: output || `Research complete in ${mode} mode (${depth} depth). Check vault for generated pages.` }] }
}

async function handleRhizomeGenerateWiki(args) {
  const vaultPath = resolveVaultPath(args, toolService)
  const repo = typeof args.repo === 'string' ? args.repo.trim() : ''
  if (!repo) throw new Error('Repository or path is required')
  const mode = typeof args.mode === 'string' ? args.mode.trim() : 'architecture'
  const depth = typeof args.depth === 'string' ? args.depth.trim() : 'fast'

  if (RHIZOME_TOOL_PATH) {
    // generate_wiki is an alias of repo_research (ADR-0152 verb table) —
    // 4c already writes the page, no separate wiki-generation call needed.
    const output = await runRhizoCli(
      RHIZOME_TOOL_PATH,
      ['repo-research', vaultPath, repo, '--mode', mode, '--depth', depth],
      120000,
    )
    return { content: [{ type: 'text', text: output || `Wiki generated in ${mode} mode (${depth} depth).` }] }
  }

  appendRhizomeEvent(vaultPath, { type: 'wiki-generate-started', mode, repo, depth })
  const rounds = depth === 'deep' ? 3 : depth === 'regular' ? 2 : 1
  const researchOutput = await runRhizoCli(
    'rhizome-research',
    [vaultPath, repo, '--rounds', String(rounds)],
    120000,
  )
  let wikiOutput = ''
  try {
    wikiOutput = await runRhizoCli(
      'rhizome-repo-wiki',
      [vaultPath, repo, '--mode', mode],
      120000,
    )
  } catch {
    wikiOutput = '(rhizome-repo-wiki command not available — research phase completed)'
  }
  appendRhizomeEvent(vaultPath, { type: 'wiki-generate-finished', mode, repo, depth })
  const text = wikiOutput
    ? `Wiki generated in ${mode} mode (${depth} depth).\\n\\nResearch:\\n${researchOutput}\\n\\nWiki:\\n${wikiOutput}`
    : researchOutput
  return { content: [{ type: 'text', text }] }
}

async function handleRhizomeGrokImport(args) {
  const vaultPath = resolveVaultPath(args, toolService)

  if (args.listOnly) {
    const target = resolveRhizoTarget(
      'rhizome-grok-import',
      [vaultPath, '--list'],
      'grok-import',
      [vaultPath, '--list'],
    )
    const output = await runRhizoCli(target.bin, target.args, 15000)
    return { content: [{ type: 'text', text: output }] }
  }

  const jsonPath = typeof args.path === 'string' ? args.path.trim() : ''
  if (jsonPath) {
    const target = resolveRhizoTarget(
      'rhizome-grok-import',
      [vaultPath, jsonPath],
      'grok-import',
      [vaultPath, jsonPath],
    )
    const output = await runRhizoCli(target.bin, target.args, 60000)
    return { content: [{ type: 'text', text: output }] }
  }

  // No path specified, auto-import from default Grok-Wiki directory.
  // rhizome_api::grok_import (Auto mode) already appends its own
  // .rhizome/events.jsonl entry per imported wiki — skip the JS-side
  // summary event on the Rust path to avoid double-logging.
  const target = resolveRhizoTarget(
    'rhizome-grok-import',
    [vaultPath, '--auto'],
    'grok-import',
    [vaultPath, '--auto'],
  )
  const output = await runRhizoCli(target.bin, target.args, 120000)
  if (!target.isRust) appendRhizomeEvent(vaultPath, { type: 'grok-import', auto: true })
  return { content: [{ type: 'text', text: output || 'Grok-Wiki import complete.' }] }
}

async function handleRhizomeImportSource(args) {
  const vaultPath = resolveVaultPath(args, toolService)
  const source = typeof args.source === 'string' ? args.source.trim() : ''
  if (!source) throw new Error('Source path or URL is required')
  const project = typeof args.project === 'string' ? args.project.trim() : undefined
  const pythonArgs = [vaultPath, source]
  if (project) pythonArgs.push('--project', project)
  const rustArgs = [vaultPath, source]
  if (project) rustArgs.push('--project', project)
  const target = resolveRhizoTarget('rhizome-import-source', pythonArgs, 'import-source', rustArgs)
  const output = await runRhizoCli(target.bin, target.args, 60000)
  // rhizome_api::import_source already appends its own .rhizome/events.jsonl
  // entry — skip the JS-side event on the Rust path to avoid double-logging.
  if (!target.isRust) appendRhizomeEvent(vaultPath, { type: 'source-imported', source, project })
  return { content: [{ type: 'text', text: output || 'Source imported successfully.' }] }
}

async function handleRhizomeDistill(args) {
  const vaultPath = resolveVaultPath(args, toolService)

  if (args.listKinds) {
    // No Rust equivalent yet — this is static enum introspection, not one
    // of the six write verbs in the ADR-0152 cutover table. Stays Python.
    const output = await runRhizoCli('rhizome-distill', [vaultPath, '--list-kinds'], 15000)
    return { content: [{ type: 'text', text: output }] }
  }

  const fromFile = typeof args.from === 'string' ? args.from.trim() : ''
  const text = typeof args.text === 'string' ? args.text.trim() : ''
  const project = typeof args.project === 'string' ? args.project.trim() : undefined
  const kind = typeof args.kind === 'string' ? args.kind.trim() : undefined

  const pythonArgs = [vaultPath]
  if (fromFile) pythonArgs.push('--from', fromFile)
  if (text) pythonArgs.push('--text', text)
  if (project) pythonArgs.push('--project', project)
  if (kind) pythonArgs.push('--kind', kind)

  const rustArgs = [vaultPath]
  if (fromFile) rustArgs.push('--from', fromFile)
  if (text) rustArgs.push('--text', text)
  if (project) rustArgs.push('--project', project)
  if (kind) rustArgs.push('--kind', kind)

  const target = resolveRhizoTarget('rhizome-distill', pythonArgs, 'distill', rustArgs)
  const output = await runRhizoCli(target.bin, target.args, 60000)
  // rhizome_api::distill already appends its own .rhizome/events.jsonl
  // entry — skip the JS-side event on the Rust path to avoid double-logging.
  if (!target.isRust) appendRhizomeEvent(vaultPath, { type: 'distill', from: fromFile || 'inline', project })
  return { content: [{ type: 'text', text: output || 'Distillation complete.' }] }
}

const TOOL_HANDLERS = new Map([
  ['search_notes', handleSearchNotes],
  ['get_vault_context', handleVaultContext],
  ['list_vaults', handleListVaults],
  ['get_note', handleGetNote],
  ['create_note', handleCreateNote],
  ['open_note', handleOpenNote],
  ['highlight_editor', handleHighlightEditor],
  ['refresh_vault', handleRefreshVault],
  ['rhizome_search', handleRhizomeSearch],
  ['rhizome_lint', handleRhizomeLint],
  ['rhizome_graph_summary', handleRhizomeGraphSummary],
  ['rhizome_repo_research', handleRhizomeRepoResearch],
  ['rhizome_generate_wiki', handleRhizomeGenerateWiki],
  ['rhizome_grok_import', handleRhizomeGrokImport],
  ['rhizome_import_source', handleRhizomeImportSource],
  ['rhizome_distill', handleRhizomeDistill],
])

function callToolHandler(name, args) {
  const handler = TOOL_HANDLERS.get(name)
  if (!handler) throw new Error(`Unknown tool: ${name}`)
  return handler(args)
}

// --- Server setup ---

const server = new Server(
  { name: 'rhizome-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  try {
    return await callToolHandler(name, args)
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }
})

async function shutdown(exitCode = 0) {
  if (shutdownStarted) return

  shutdownStarted = true
  clearUiReconnectTimer()
  closeUiSocket()

  try {
    await server.close()
  } catch (error) {
    console.error(`[mcp] Error while closing server: ${error.message}`)
  }

  process.exitCode = exitCode
  setImmediate(() => process.exit(exitCode))
}

async function main() {
  const transport = new StdioServerTransport()
  server.onclose = () => {
    void shutdown(0)
  }
  process.stdin.once('end', () => {
    void shutdown(0)
  })
  process.stdin.once('close', () => {
    void shutdown(0)
  })
  process.once('SIGINT', () => {
    void shutdown(0)
  })
  process.once('SIGTERM', () => {
    void shutdown(0)
  })

  connectUiBridge()
  await server.connect(transport)
  console.error('Rhizome MCP server running (vaults resolved per call)')
}

main().catch((error) => {
  console.error(error)
  void shutdown(1)
})
