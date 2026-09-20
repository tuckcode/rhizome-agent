import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { symlinkSync } from 'node:fs'
import {
  access, mkdtemp, mkdir, open, readFile, rm, writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  createNote, findMarkdownFiles, getNote, searchNotes, vaultContext,
} from './vault.js'
import { isHomeVaultPath, requireVaultPath, requireVaultPaths } from './vault-path.js'
import { vaultContextWithInstructions } from './agent-instructions.js'
import {
  BRIDGE_AUTH_TOOL, buildSaveCaptureArgs, evaluateBridgeRequest, evaluateToolMessage,
  isBrowserExtensionOrigin,
} from './ws-bridge.js'

let tmpDir
const ACTIVE_VAULT_ERROR = 'Note path must stay inside the active vault'
const MCP_SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))

before(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-test-'))

  await mkdir(path.join(tmpDir, 'project'), { recursive: true })
  await mkdir(path.join(tmpDir, 'note'), { recursive: true })

  await writeTextFile(path.join(tmpDir, 'project', 'test-project.md'), `---
title: Test Project
is_a: Project
status: Active
---

# Test Project

This is a test project for the MCP server.
`)

  await writeTextFile(path.join(tmpDir, 'note', 'daily-log.md'), `---
title: Daily Log
is_a: Note
---

# Daily Log

Today I worked on the MCP server implementation.
`)

  await writeTextFile(path.join(tmpDir, 'note', 'hashtag-tags.md'), `---
title: Hashtag Tags
type: Note
tags: [#abc, def, ghi]
---

# Hashtag Tags

This note has AI-generated hashtag-style YAML tags.
`)

  await writeTextFile(path.join(tmpDir, 'project', 'second-project.md'), `---
title: Second Project
type: Project
status: Draft
belongs_to:
  - "[[project/test-project]]"
---

# Second Project

Another project for testing list and context.
`)
})

after(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('findMarkdownFiles', () => {
  it('should find all .md files recursively', async () => {
    const files = await findMarkdownFiles(tmpDir)
    assert.equal(files.length, 4)
    assert.ok(files.some(f => f.endsWith('test-project.md')))
    assert.ok(files.some(f => f.endsWith('daily-log.md')))
    assert.ok(files.some(f => f.endsWith('second-project.md')))
    assert.ok(files.some(f => f.endsWith('hashtag-tags.md')))
  })
})

describe('getNote', () => {
  it('should read a note with parsed frontmatter', async () => {
    const note = await getNote(tmpDir, 'project/test-project.md')
    assert.equal(note.path, 'project/test-project.md')
    assert.equal(note.frontmatter.title, 'Test Project')
    assert.equal(note.frontmatter.is_a, 'Project')
    assert.ok(note.content.includes('test project for the MCP server'))
  })

  it('should tolerate hashtag-style tags in malformed YAML frontmatter', async () => {
    const note = await getNote(tmpDir, 'note/hashtag-tags.md')
    assert.equal(note.path, 'note/hashtag-tags.md')
    assert.equal(note.frontmatter.title, 'Hashtag Tags')
    assert.equal(note.frontmatter.type, 'Note')
    assert.deepEqual(note.frontmatter.tags, ['#abc', 'def', 'ghi'])
    assert.ok(note.content.includes('has AI-generated hashtag-style YAML tags'))
  })

  it('should throw for missing notes', async () => {
    await assert.rejects(
      () => getNote(tmpDir, 'nonexistent.md'),
      { code: 'ENOENT' }
    )
  })

  it('should reject absolute paths outside the vault', async () => {
    await assertRejectsOutsideVault('laputa-mcp-outside-', outsideNote => outsideNote)
  })

  it('should reject traversal paths outside the vault', async () => {
    await assertRejectsOutsideVault(
      'laputa-mcp-traversal-',
      outsideNote => path.relative(tmpDir, outsideNote),
    )
  })
})

describe('createNote', () => {
  it('creates a new markdown note inside the vault', async () => {
    const vaultDir = await mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-create-'))
    const content = `---
type: Note
---

# MCP Created
`

    try {
      const note = await createNote(vaultDir, 'note/mcp-created.md', content)
      assert.equal(note.path, 'note/mcp-created.md')
      assert.equal(await readFile(path.join(vaultDir, note.path), 'utf-8'), content)
    } finally {
      await rm(vaultDir, { recursive: true, force: true })
    }
  })

  it('does not overwrite an existing note', async () => {
    const vaultDir = await mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-create-existing-'))
    const notePath = path.join(vaultDir, 'existing.md')
    await writeFile(notePath, '# Existing\n', 'utf-8')

    try {
      await assert.rejects(
        () => createNote(vaultDir, 'existing.md', '# Replacement\n'),
        { code: 'EEXIST' },
      )
      assert.equal(await readFile(notePath, 'utf-8'), '# Existing\n')
    } finally {
      await rm(vaultDir, { recursive: true, force: true })
    }
  })

  it('rejects absolute paths outside the vault', async () => {
    const vaultDir = await mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-create-vault-'))
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-create-outside-'))

    try {
      await assert.rejects(
        () => createNote(vaultDir, path.join(outsideDir, 'outside.md'), '# Outside\n'),
        { message: ACTIVE_VAULT_ERROR },
      )
    } finally {
      await rm(vaultDir, { recursive: true, force: true })
      await rm(outsideDir, { recursive: true, force: true })
    }
  })

  it('rejects outside paths before creating missing parent folders', async () => {
    const vaultDir = await mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-create-vault-'))
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), 'laputa-mcp-create-outside-'))
    const outsideParent = path.join(outsideDir, 'missing-parent')

    try {
      await assert.rejects(
        () => createNote(vaultDir, path.join(outsideParent, 'outside.md'), '# Outside\n'),
        { message: ACTIVE_VAULT_ERROR },
      )
      await assert.rejects(() => access(outsideParent), { code: 'ENOENT' })
    } finally {
      await rm(vaultDir, { recursive: true, force: true })
      await rm(outsideDir, { recursive: true, force: true })
    }
  })
})

describe('searchNotes', () => {
  it('should find notes matching title', async () => {
    const results = await searchNotes(tmpDir, 'Test Project')
    assert.ok(results.length >= 1)
    assert.equal(results[0].title, 'Test Project')
  })

  it('should find notes matching content', async () => {
    const results = await searchNotes(tmpDir, 'MCP server')
    assert.ok(results.length >= 1)
  })

  it('should return empty for no matches', async () => {
    const results = await searchNotes(tmpDir, 'xyzzy-nonexistent-12345')
    assert.equal(results.length, 0)
  })

  it('should respect limit', async () => {
    const results = await searchNotes(tmpDir, 'project', 1)
    assert.ok(results.length <= 1)
  })
})

describe('vaultContext', () => {
  it('should return types, recent notes, and vault path', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.ok(Array.isArray(ctx.types))
    assert.ok(Array.isArray(ctx.recentNotes))
    assert.equal(ctx.vaultPath, tmpDir)
  })

  it('should include known entity types', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.ok(ctx.types.includes('Project'))
    assert.ok(ctx.types.includes('Note'))
  })

  it('should include notes with hashtag-style tags in malformed YAML frontmatter', async () => {
    const ctx = await vaultContext(tmpDir)
    const note = ctx.recentNotes.find(entry => entry.path === 'note/hashtag-tags.md')
    assert.ok(note)
    assert.equal(note.title, 'Hashtag Tags')
    assert.equal(note.type, 'Note')
  })

  it('should cap recent notes at 20', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.ok(ctx.recentNotes.length <= 20)
  })

  it('should include path and title in recent notes', async () => {
    const ctx = await vaultContext(tmpDir)
    for (const note of ctx.recentNotes) {
      assert.ok(note.path)
      assert.ok(note.title)
    }
  })

  it('should include folders', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.ok(ctx.folders.includes('project/'))
    assert.ok(ctx.folders.includes('note/'))
  })

  it('should report correct note count', async () => {
    const ctx = await vaultContext(tmpDir)
    assert.equal(ctx.noteCount, 4)
  })

  it('includes root AGENTS.md instructions when present', async () => {
    const agentsPath = path.join(tmpDir, 'AGENTS.md')
    await writeFile(agentsPath, '# Vault Rules\n\nUse this vault carefully.\n', 'utf-8')

    try {
      const ctx = await vaultContextWithInstructions(tmpDir)
      assert.deepEqual(ctx.agentInstructions, {
        path: agentsPath,
        content: '# Vault Rules\n\nUse this vault carefully.\n',
      })
    } finally {
      await rm(agentsPath, { force: true })
    }
  })

  it('reports null agent instructions when AGENTS.md is absent', async () => {
    const ctx = await vaultContextWithInstructions(tmpDir)
    assert.equal(ctx.agentInstructions, null)
  })
})

describe('evaluateBridgeRequest', () => {
  it('accepts loopback UI requests from trusted origins', () => {
    assert.deepEqual(
      evaluateBridgeRequest({
        bridgeType: 'ui',
        origin: 'http://localhost:5202',
        remoteAddress: '127.0.0.1',
      }),
      { ok: true, reason: null },
    )
  })

  it('rejects browser origins on the tool bridge', () => {
    assert.deepEqual(
      evaluateBridgeRequest({
        bridgeType: 'tool',
        origin: 'https://evil.example',
        remoteAddress: '127.0.0.1',
      }),
      { ok: false, reason: 'browser origins are not allowed on the tool bridge' },
    )
  })

  it('rejects non-loopback clients even without an origin', () => {
    assert.deepEqual(
      evaluateBridgeRequest({
        bridgeType: 'ui',
        origin: undefined,
        remoteAddress: '192.168.1.10',
      }),
      { ok: false, reason: 'non-local client' },
    )
  })

  it('lets a browser-extension origin onto the tool bridge to authenticate', () => {
    for (const origin of [
      'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      'moz-extension://11111111-2222-3333-4444-555555555555',
    ]) {
      assert.deepEqual(
        evaluateBridgeRequest({ bridgeType: 'tool', origin, remoteAddress: '127.0.0.1' }),
        { ok: true, reason: null },
        origin,
      )
    }
  })

  it('still rejects every non-extension browser origin on the tool bridge', () => {
    for (const origin of [
      'https://evil.example',
      'http://localhost:5202',
      'chrome-extension:',
      'chrome-extension://has/a/path',
    ]) {
      assert.equal(
        evaluateBridgeRequest({ bridgeType: 'tool', origin, remoteAddress: '127.0.0.1' }).ok,
        false,
        origin,
      )
    }
  })
})

describe('isBrowserExtensionOrigin', () => {
  it('matches only extension schemes with a bare host', () => {
    assert.equal(isBrowserExtensionOrigin('chrome-extension://abc'), true)
    assert.equal(isBrowserExtensionOrigin('safari-web-extension://abc'), true)
    assert.equal(isBrowserExtensionOrigin('https://abc'), false)
    assert.equal(isBrowserExtensionOrigin(undefined), false)
  })
})

describe('buildSaveCaptureArgs', () => {
  it('builds argv with the vault and source positional, flags for the rest', () => {
    assert.deepEqual(
      buildSaveCaptureArgs('/vault', {
        source: 'https://example.com/a',
        title: 'A Page',
        context: 'Why it matters.',
        text: 'Body.',
      }),
      [
        'save-capture', '/vault', 'https://example.com/a',
        '--title', 'A Page',
        '--context', 'Why it matters.',
        '--text', 'Body.',
        '--trigger', 'browser_extension',
      ],
    )
  })

  it('omits absent optional flags rather than passing empty strings', () => {
    assert.deepEqual(
      buildSaveCaptureArgs('/vault', { source: 'https://example.com/a' }),
      ['save-capture', '/vault', 'https://example.com/a', '--trigger', 'browser_extension'],
    )
  })

  it('refuses a missing or non-string source', () => {
    for (const args of [{}, { source: '' }, { source: 42 }]) {
      assert.throws(() => buildSaveCaptureArgs('/vault', args), /source/u, JSON.stringify(args))
    }
  })

  it('keeps a flag-looking source as a value, never as argv', () => {
    // argv array, never a shell string (ADR-0152) — a source that starts
    // with a dash is still one element, not a new flag.
    assert.deepEqual(
      buildSaveCaptureArgs('/vault', { source: '--title' }),
      ['save-capture', '/vault', '--title', '--trigger', 'browser_extension'],
    )
  })
})

describe('evaluateToolMessage', () => {
  const expectedToken = 'a-real-token'

  it('refuses to dispatch for an extension client that has not authenticated', () => {
    assert.deepEqual(
      evaluateToolMessage({
        requiresAuth: true, authenticated: false, tool: 'rhizome_save_capture', expectedToken,
      }),
      { action: 'reject', reason: 'bridge client is not authenticated' },
    )
  })

  it('authenticates on the right token and then dispatches', () => {
    assert.deepEqual(
      evaluateToolMessage({
        requiresAuth: true, authenticated: false, tool: BRIDGE_AUTH_TOOL, token: expectedToken, expectedToken,
      }),
      { action: 'authenticate', reason: null },
    )
    assert.deepEqual(
      evaluateToolMessage({
        requiresAuth: true, authenticated: true, tool: 'rhizome_save_capture', expectedToken,
      }),
      { action: 'dispatch', reason: null },
    )
  })

  it('rejects a wrong or missing token', () => {
    for (const token of ['wrong', '', undefined]) {
      assert.equal(
        evaluateToolMessage({
          requiresAuth: true, authenticated: false, tool: BRIDGE_AUTH_TOOL, token, expectedToken,
        }).action,
        'reject',
        String(token),
      )
    }
  })

  it('rejects auth outright when the app configured no token', () => {
    // Fail closed: an unconfigured bridge must not become an open one.
    assert.deepEqual(
      evaluateToolMessage({
        requiresAuth: true, authenticated: false, tool: BRIDGE_AUTH_TOOL, token: '', expectedToken: '',
      }),
      { action: 'reject', reason: 'bridge token not configured' },
    )
  })

  it('leaves non-browser clients — the MCP server, the app — unauthenticated and dispatching', () => {
    assert.deepEqual(
      evaluateToolMessage({
        requiresAuth: false, authenticated: false, tool: 'search_notes', expectedToken,
      }),
      { action: 'dispatch', reason: null },
    )
  })
})

describe('requireVaultPath', () => {
  it('returns the explicit configured vault path', () => {
    assert.equal(
      requireVaultPath({ VAULT_PATH: '/tmp/Selected Vault' }),
      '/tmp/Selected Vault',
    )
  })

  it('rejects missing vault paths instead of falling back to ~/Laputa', async () => {
    const configDir = await mkdtemp(path.join(os.tmpdir(), 'tolaria-mcp-empty-config-'))
    assert.throws(
      () => requireVaultPaths({}, { configDir }),
      /VAULT_PATH is required/,
    )
    await rm(configDir, { recursive: true, force: true })
  })

  it('returns all configured active vault paths with the primary vault first', () => {
    assert.deepEqual(
      requireVaultPaths({
        VAULT_PATH: '/tmp/Default Vault',
        VAULT_PATHS: JSON.stringify(['/tmp/Default Vault', '/tmp/Second Vault']),
      }),
      ['/tmp/Default Vault', '/tmp/Second Vault'],
    )
  })

  it('prefers com.rhizome.app vaults.json over leftover Tolaria config', async () => {
    const configDir = await mkdtemp(path.join(os.tmpdir(), 'rhizome-mcp-config-'))
    const rhizomeVault = path.join(configDir, 'Rhizome Vault')
    const staleVault = path.join(configDir, 'Stale Vault')
    await mkdir(path.join(configDir, 'com.rhizome.app'), { recursive: true })
    await mkdir(path.join(configDir, 'com.tolaria.app'), { recursive: true })
    await writeFile(path.join(configDir, 'com.rhizome.app', 'vaults.json'), JSON.stringify({
      active_vault: rhizomeVault,
      vaults: [{ label: 'Rhizome', path: rhizomeVault, mounted: true }],
    }), 'utf-8')
    await writeFile(path.join(configDir, 'com.tolaria.app', 'vaults.json'), JSON.stringify({
      active_vault: staleVault,
      vaults: [{ label: 'Stale', path: staleVault, mounted: true }],
    }), 'utf-8')

    try {
      assert.deepEqual(requireVaultPaths({}, { configDir }), [rhizomeVault])
    } finally {
      await rm(configDir, { recursive: true, force: true })
    }
  })

  it('refuses $HOME as a vault path', () => {
    const home = os.homedir()
    assert.equal(isHomeVaultPath(home), true)
    assert.equal(isHomeVaultPath(path.join(home, 'Documents')), false)
    assert.throws(
      () => requireVaultPaths({ VAULT_PATH: home }),
      /home directory/,
    )
  })

  it('refuses a tilde alias of $HOME as a vault path', () => {
    const home = os.homedir()
    assert.equal(isHomeVaultPath('~'), true)
    assert.equal(isHomeVaultPath('~/'), true)
    assert.equal(isHomeVaultPath('~/Documents'), false)
    assert.throws(
      () => requireVaultPaths({ VAULT_PATH: '~' }),
      /home directory/,
    )
    assert.throws(
      () => requireVaultPaths({ VAULT_PATH: '~/' }),
      /home directory/,
    )
    assert.deepEqual(
      requireVaultPaths({ VAULT_PATH: '~/Documents' }),
      [path.join(home, 'Documents')],
    )
  })

  it('refuses a symlink that resolves to $HOME', async () => {
    const home = os.homedir()
    const dir = await mkdtemp(path.join(os.tmpdir(), 'home-link-'))
    const link = path.join(dir, 'home-alias')
    try {
      symlinkSync(home, link)
    } catch {
      await rm(dir, { recursive: true, force: true })
      return
    }
    try {
      assert.equal(isHomeVaultPath(link), true)
      assert.throws(
        () => requireVaultPaths({ VAULT_PATH: link }),
        /home directory/,
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('loads active mounted vault paths from Tolaria config when env is vault-neutral', async () => {
    const configDir = await mkdtemp(path.join(os.tmpdir(), 'tolaria-mcp-config-'))
    const primaryVault = path.join(configDir, 'Primary Vault')
    const secondaryVault = path.join(configDir, 'Secondary Vault')
    const hiddenVault = path.join(configDir, 'Hidden Vault')
    const configPath = path.join(configDir, 'com.tolaria.app', 'vaults.json')

    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(configPath, JSON.stringify({
      active_vault: primaryVault,
      vaults: [
        { label: 'Secondary', path: secondaryVault, mounted: true },
        { label: 'Hidden', path: hiddenVault, mounted: false },
        { label: 'Primary', path: primaryVault, mounted: true },
      ],
    }), 'utf-8')

    try {
      assert.deepEqual(
        requireVaultPaths({}, { configDir }),
        [primaryVault, secondaryVault],
      )
    } finally {
      await rm(configDir, { recursive: true, force: true })
    }
  })
})

describe('stdio process lifecycle', () => {
  it('advertises local vault tools as approval-safe for MCP clients', async () => {
    const { client, stderr } = await connectMcpClient()

    try {
      const { tools } = await client.listTools()
      const toolsByName = new Map(tools.map(tool => [tool.name, tool]))
      const safeReadTools = [
        'search_notes',
        'get_vault_context',
        'list_vaults',
        'get_note',
        'open_note',
        'highlight_editor',
        'refresh_vault',
      ]

      for (const name of safeReadTools) {
        const tool = toolsByName.get(name)
        assert.ok(tool, `Missing MCP tool: ${name}`)
        assert.equal(tool.annotations?.readOnlyHint, true, `${name} should not require destructive approval`)
        assert.equal(tool.annotations?.destructiveHint, false, `${name} should not be treated as destructive`)
        assert.equal(tool.annotations?.openWorldHint, false, `${name} should stay scoped to local active vaults`)
      }

      const createTool = toolsByName.get('create_note')
      assert.ok(createTool, 'Missing MCP tool: create_note')
      assert.equal(createTool.annotations?.readOnlyHint, false)
      assert.equal(createTool.annotations?.destructiveHint, false)
      assert.equal(createTool.annotations?.openWorldHint, false)
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('advertises the scoped graph query tools with their required arguments', async () => {
    const { client, stderr } = await connectMcpClient()

    try {
      const { tools } = await client.listTools()
      const toolsByName = new Map(tools.map(tool => [tool.name, tool]))
      const expected = {
        rhizome_graph_health: [],
        rhizome_graph_orphans: [],
        rhizome_graph_dead_links: [],
        rhizome_graph_neighbors: ['note'],
        rhizome_graph_path: ['from', 'to'],
      }

      for (const [name, required] of Object.entries(expected)) {
        const tool = toolsByName.get(name)
        assert.ok(tool, `Missing MCP tool: ${name}`)
        assert.equal(tool.annotations?.readOnlyHint, true, `${name} should be read-only`)
        assert.deepEqual(tool.inputSchema?.required ?? [], required, `${name} required args`)
      }
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('does not advertise Grok-wiki / wiki-generation verbs (AGENTS.md out of scope)', async () => {
    const { client, stderr } = await connectMcpClient()

    try {
      const { tools } = await client.listTools()
      const names = tools.map(tool => tool.name)
      for (const name of [
        'rhizome_grok_import',
        'rhizome_generate_wiki',
        'rhizome_repo_research',
      ]) {
        assert.equal(names.includes(name), false, `${name} must not be in the MCP tool list`)
      }
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('says what is missing when a graph query runs without the sidecar', async () => {
    const { client, stderr } = await connectMcpClient()

    try {
      const result = await client.callTool({
        name: 'rhizome_graph_health',
        arguments: {},
      })
      const text = result.content?.[0]?.text ?? ''
      // No RHIZOME_TOOL_PATH in the test env: the failure must name the
      // binary to set, not surface as an opaque spawn error.
      assert.match(text, /RHIZOME_TOOL_PATH/)
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('says what is missing when rhizome_graph_summary runs without the sidecar (C40)', async () => {
    // Before the C40 fix this silently ran the external `rhizome-graph`
    // Python CLI instead of erroring — wrong numbers with no signal
    // anything was off. It must now fail the same way rhizome_graph_health
    // does rather than falling back to the disagreeing CLI.
    const { client, stderr } = await connectMcpClient()

    try {
      const result = await client.callTool({
        name: 'rhizome_graph_summary',
        arguments: {},
      })
      const text = result.content?.[0]?.text ?? ''
      assert.match(text, /RHIZOME_TOOL_PATH/)
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('creates a note through the MCP create_note tool', async () => {
    const { client, stderr } = await connectMcpClient()
    const relativePath = 'note/mcp-tool-created.md'
    const absolutePath = path.join(tmpDir, relativePath)
    const content = `---
type: Note
---

# MCP Tool Created
`

    try {
      await rm(absolutePath, { force: true })
      const result = await client.callTool({
        name: 'create_note',
        arguments: { path: relativePath, content },
      })

      assert.equal(await readFile(absolutePath, 'utf-8'), content)
      assert.match(JSON.stringify(result.content), /mcp-tool-created\.md/)
    } finally {
      await rm(absolutePath, { force: true })
      await closeMcpClient(client, stderr)
    }
  })

  it('exits when the MCP client closes stdin', async () => {
    const child = spawn(process.execPath, ['index.js'], {
      cwd: MCP_SERVER_DIR,
      env: { ...process.env, VAULT_PATH: tmpDir, WS_UI_PORT: '65534' },
      stdio: ['pipe', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })

    await sleep(200)
    child.stdin.end()

    const exit = await waitForExit(child, 1_500)
    if (!exit) {
      child.kill()
      await waitForExit(child, 1_000)
      assert.fail(`MCP server stayed alive after stdin closed.\n${stderr}`)
    }

    assert.equal(exit.signal, null)
    assert.equal(exit.code, 0, stderr)
  })
})

describe('RHIZOME_TOOL_PATH wiring (ADR-0152 MCP bridge Phase 2)', () => {
  let stubDir
  let stubPath
  let argvLogPath

  before(async () => {
    stubDir = await mkdtemp(path.join(os.tmpdir(), 'rhizome-tool-stub-'))
    stubPath = path.join(stubDir, 'rhizome-tool-stub.mjs')
    argvLogPath = path.join(stubDir, 'argv.jsonl')
    await writeFile(argvLogPath, '', 'utf-8')
    await writeFile(stubPath, `#!/usr/bin/env node
import { appendFileSync } from 'node:fs'
appendFileSync(process.env.STUB_ARGV_LOG, JSON.stringify(process.argv.slice(2)) + '\\n')
console.log('[]')
`, 'utf-8')
    await open(stubPath, 'r').then(async handle => {
      await handle.chmod(0o755)
      await handle.close()
    })
  })

  after(async () => {
    await rm(stubDir, { recursive: true, force: true })
  })

  async function lastStubArgv() {
    const lines = (await readFile(argvLogPath, 'utf-8')).trim().split('\n')
    return JSON.parse(lines.at(-1))
  }

  it('routes rhizome_search through the rhizome-tool subcommand shape when the env var is set', async () => {
    const { client, stderr } = await connectMcpClient({
      RHIZOME_TOOL_PATH: stubPath,
      STUB_ARGV_LOG: argvLogPath,
    })
    try {
      await client.callTool({ name: 'rhizome_search', arguments: { query: 'distributed systems', limit: 5 } })
      assert.deepEqual(await lastStubArgv(), ['search', tmpDir, 'distributed systems', '--limit', '5'])
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('routes rhizome_distill through the distill subcommand and skips the JS-side event to avoid double-logging', async () => {
    const { client, stderr } = await connectMcpClient({
      RHIZOME_TOOL_PATH: stubPath,
      STUB_ARGV_LOG: argvLogPath,
    })
    const eventsFile = path.join(tmpDir, '.rhizome', 'events.jsonl')
    try {
      const before = await readFile(eventsFile, 'utf-8').catch(() => '')
      await client.callTool({
        name: 'rhizome_distill',
        arguments: { text: 'some text', project: 'rhizome', kind: 'concept' },
      })
      assert.deepEqual(
        await lastStubArgv(),
        ['distill', tmpDir, '--text', 'some text', '--project', 'rhizome', '--kind', 'concept'],
      )
      const after = await readFile(eventsFile, 'utf-8').catch(() => '')
      assert.equal(after, before, 'JS-side appendRhizomeEvent must not fire on the Rust path')
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('routes rhizome_graph_summary through the same graph-query health call as rhizome_graph_health (C40 regression guard)', async () => {
    // rhizome_graph_summary used to shell out to the external `rhizome-graph`
    // CLI, which builds its own graph and disagrees with the app's own graph
    // view (docs/HANDOFF.md C40). It must now answer from the same in-repo
    // graph as every other rhizome_graph_* tool.
    const { client, stderr } = await connectMcpClient({
      RHIZOME_TOOL_PATH: stubPath,
      STUB_ARGV_LOG: argvLogPath,
    })
    try {
      await client.callTool({ name: 'rhizome_graph_summary', arguments: {} })
      assert.deepEqual(await lastStubArgv(), ['graph-query', tmpDir, 'health'])
    } finally {
      await closeMcpClient(client, stderr)
    }
  })

  it('never invokes the rhizome-tool sidecar when RHIZOME_TOOL_PATH is unset (regression guard)', async () => {
    const before = (await readFile(argvLogPath, 'utf-8')).trim().split('\n').filter(Boolean).length
    const { client, stderr } = await connectMcpClient()
    try {
      // Whether the local Python `rhizome-search` toolkit is installed on
      // this machine or not, the point is the stub must never see argv.
      await client.callTool({ name: 'rhizome_search', arguments: { query: 'anything' } }).catch(() => {})
      const after = (await readFile(argvLogPath, 'utf-8')).trim().split('\n').filter(Boolean).length
      assert.equal(after, before, 'rhizome-tool stub must not run on the default Python path')
    } finally {
      await closeMcpClient(client, stderr)
    }
  })
})

async function connectMcpClient(extraEnv = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['index.js'],
    cwd: MCP_SERVER_DIR,
    env: { ...process.env, VAULT_PATH: tmpDir, WS_UI_PORT: '65534', ...extraEnv },
    stderr: 'pipe',
  })
  const stderr = collectTransportStderr(transport)
  const client = new Client(
    { name: 'tolaria-mcp-test-client', version: '0.0.0' },
    { capabilities: {} },
  )

  await client.connect(transport)
  return { client, stderr }
}

function collectTransportStderr(transport) {
  const chunks = []
  transport.stderr?.setEncoding('utf8')
  transport.stderr?.on('data', chunk => {
    chunks.push(chunk)
  })
  return () => chunks.join('')
}

async function closeMcpClient(client, stderr) {
  try {
    await client.close()
  } catch (error) {
    assert.fail(`Failed to close MCP test client: ${error.message}\n${stderr()}`)
  }
}

async function assertRejectsOutsideVault(prefix, resolveNotePath) {
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), prefix))
  const outsideNote = path.join(outsideDir, 'outside.md')

  try {
    await writeTextFile(outsideNote, '# Outside\n')
    await assert.rejects(
      () => getNote(tmpDir, resolveNotePath(outsideNote)),
      { message: ACTIVE_VAULT_ERROR },
    )
  } finally {
    await rm(outsideDir, { recursive: true, force: true })
  }
}

async function writeTextFile(filePath, content) {
  const handle = await open(filePath, 'w')
  try {
    await handle.writeFile(content, 'utf-8')
  } finally {
    await handle.close()
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)

    child.once('exit', onExit)

    function onExit(code, signal) {
      cleanup()
      resolve({ code, signal })
    }

    function cleanup() {
      clearTimeout(timer)
      child.off('exit', onExit)
    }
  })
}
