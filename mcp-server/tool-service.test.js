import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createMcpToolService } from './tool-service.js'

let tmpDir
let firstVault
let secondVault

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'tolaria-mcp-service-'))
  firstVault = path.join(tmpDir, 'First Vault')
  secondVault = path.join(tmpDir, 'Second Vault')

  await seedVault(firstVault, {
    'note/shared.md': noteFixture('Shared Note', 'Shared content from the first vault.'),
    'note/alpha.md': noteFixture('Alpha Project', 'Project planning in the first vault.'),
  })
  await seedVault(secondVault, {
    'AGENTS.md': '# Second Vault Rules\n',
    'note/shared.md': noteFixture('Shared Note', 'Shared content from the second vault.'),
    'note/beta.md': noteFixture('Beta Project', 'Project planning in the second vault.'),
  })
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('createMcpToolService', () => {
  it('requires vaultPath when reading an ambiguous note path', async () => {
    const service = makeService()

    await assert.rejects(
      () => service.readNote({ path: 'note/shared.md' }),
      /Note path is ambiguous across active vaults/,
    )

    const note = await service.readNote({
      path: 'note/shared.md',
      vaultPath: secondVault,
    })

    assert.equal(note.vaultPath, secondVault)
    assert.equal(note.vaultLabel, 'Second Vault')
    assert.match(note.content, /second vault/)
  })

  it('creates notes with fallback markdown and emits refresh and tab actions', async () => {
    const emittedActions = []
    const service = makeService({ emittedActions })
    const absolutePath = path.join(secondVault, 'note/created.md')

    const note = await service.createNote({
      path: absolutePath,
      title: 'Created From MCP',
      type: 'Project',
    })

    assert.equal(note.path, 'note/created.md')
    assert.equal(note.vaultPath, secondVault)
    assert.equal(path.basename(note.absolutePath), 'created.md')
    assert.equal(
      await readFile(note.absolutePath, 'utf-8'),
      '---\ntype: "Project"\n---\n\n# Created From MCP\n',
    )
    assert.deepEqual(emittedActions, [
      { action: 'vault_changed', payload: { path: absolutePath } },
      { action: 'open_tab', payload: { path: absolutePath } },
    ])
  })

  it('searches active vaults with consistent vault metadata', async () => {
    const service = makeService()

    const results = await service.searchNotes({ query: 'Project', limit: 2 })

    assert.equal(results.length, 2)
    assert.deepEqual(
      results.map(({ path: notePath, vaultPath, vaultLabel }) => ({
        notePath,
        vaultPath,
        vaultLabel,
      })),
      [
        { notePath: 'note/alpha.md', vaultPath: firstVault, vaultLabel: 'First Vault' },
        { notePath: 'note/beta.md', vaultPath: secondVault, vaultLabel: 'Second Vault' },
      ],
    )
  })

  it('lists active vaults with agent-instruction metadata', async () => {
    const service = makeService()

    assert.deepEqual(await service.listVaults(), {
      vaults: [
        {
          path: firstVault,
          label: 'First Vault',
          agentInstructionsPath: null,
          hasAgentInstructions: false,
        },
        {
          path: secondVault,
          label: 'Second Vault',
          agentInstructionsPath: path.join(secondVault, 'AGENTS.md'),
          hasAgentInstructions: true,
        },
      ],
    })
  })

  it('emits transport-neutral UI intents for note opening and filters', () => {
    const emittedActions = []
    const service = makeService({ emittedActions })

    service.openNoteAsTab({ path: 'note/beta.md', vaultPath: secondVault })
    service.openNoteInEditor({ path: 'note/beta.md', vaultPath: secondVault })
    service.highlightEditor({ element: 'editor', path: 'note/beta.md' })
    service.setFilter({ type: 'Project' })
    service.refreshVault({ path: 'note/beta.md', vaultPath: secondVault })

    assert.deepEqual(emittedActions, [
      { action: 'vault_changed', payload: { path: path.join(secondVault, 'note/beta.md') } },
      { action: 'open_tab', payload: { path: path.join(secondVault, 'note/beta.md') } },
      { action: 'vault_changed', payload: { path: path.join(secondVault, 'note/beta.md') } },
      { action: 'open_note', payload: { path: path.join(secondVault, 'note/beta.md') } },
      { action: 'highlight', payload: { element: 'editor', path: 'note/beta.md' } },
      { action: 'set_filter', payload: { filterType: 'Project' } },
      { action: 'vault_changed', payload: { path: path.join(secondVault, 'note/beta.md') } },
    ])
  })
})

function makeService({ emittedActions = [] } = {}) {
  return createMcpToolService({
    resolveVaultPaths: () => [firstVault, secondVault],
    emitUiAction: (action, payload) => {
      emittedActions.push({ action, payload })
    },
  })
}

async function seedVault(vaultPath, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(vaultPath, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }
}

function noteFixture(title, body) {
  return `---\ntitle: ${JSON.stringify(title)}\ntype: Note\n---\n\n# ${title}\n\n${body}\n`
}

describe('showConfetti', () => {
  /**
   * Prime decides when something was worth marking; the app decides whether to
   * show it. This tool only carries the request across — every refusal (the
   * setting, reduced motion, the cooldown) belongs to the gate in the UI, and
   * duplicating any of that judgement here would let the two disagree.
   */
  it('asks the UI to celebrate, passing the message and attribution', () => {
    const actions = []
    const service = createMcpToolService({
      resolveVaultPaths: () => ({ vaultPath: firstVault, vaultPaths: [firstVault] }),
      emitUiAction: (action, payload) => actions.push({ action, payload }),
    })

    const result = service.showConfetti({ message: 'Migration landed', from: 'Prime' })

    assert.deepEqual(actions, [
      { action: 'celebrate', payload: { message: 'Migration landed', from: 'Prime' } },
    ])
    assert.equal(result.ok, true)
  })

  it('works with no message at all — confetti on its own is a complete answer', () => {
    const actions = []
    const service = createMcpToolService({
      resolveVaultPaths: () => ({ vaultPath: firstVault, vaultPaths: [firstVault] }),
      emitUiAction: (action, payload) => actions.push({ action, payload }),
    })

    service.showConfetti()

    assert.deepEqual(actions, [{ action: 'celebrate', payload: {} }])
  })

  /**
   * A toast is a one-line congratulation, not a place to report. Prime is
   * capable of sending several paragraphs, and the trim keeps a stray essay
   * from covering the window it is celebrating.
   */
  it('trims and truncates an overlong message rather than refusing it', () => {
    const actions = []
    const service = createMcpToolService({
      resolveVaultPaths: () => ({ vaultPath: firstVault, vaultPaths: [firstVault] }),
      emitUiAction: (action, payload) => actions.push({ action, payload }),
    })

    service.showConfetti({ message: `  ${'x'.repeat(500)}  `, from: '   ' })

    const sent = actions[0].payload
    assert.equal(sent.message.length <= 140, true)
    assert.equal('from' in sent, false, 'a blank attribution is omitted, not sent empty')
  })
})
