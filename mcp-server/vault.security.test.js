import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { symlinkSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {
  createNote,
  findMarkdownFiles,
  getNote,
  searchNotes,
  vaultContext,
} from './vault.js'
import { readAgentInstructions } from './agent-instructions.js'
import { createMcpToolService } from './tool-service.js'

const ACTIVE_VAULT_ERROR = 'Note path must stay inside the active vault'
const SENTINEL = 'RHIZOME_SYNTHETIC_OUTSIDE_SENTINEL'
const FRONTMATTER_MARK = '__RHIZOME_S1_FRONTMATTER__'

let fixture
let vault
let outside

beforeEach(async () => {
  fixture = await mkdtemp(path.join(os.tmpdir(), 'rhizome-mcp-sec-'))
  vault = path.join(fixture, 'vault')
  outside = path.join(fixture, 'outside.md')
  await mkdir(path.join(vault, 'config'), { recursive: true })
  await mkdir(path.join(vault, 'note'), { recursive: true })
  await writeFile(outside, `---\ntitle: ${SENTINEL}\n---\n# ${SENTINEL}\n${SENTINEL}\n`)
  await writeFile(path.join(vault, 'normal.md'), `---\ntitle: Inside\ntype: Note\n---\n# Normal\nInside fixture\n`)
  await writeFile(
    path.join(vault, 'note', 'nested.md'),
    `---\ntitle: Nested\ntype: Note\n---\n# Nested\nNested normal note\n`,
  )
})

afterEach(async () => {
  delete globalThis[FRONTMATTER_MARK]
  await rm(fixture, { recursive: true, force: true })
})

function executableFrontmatter(markerValue) {
  return `---javascript\n({title: (globalThis.${FRONTMATTER_MARK} = ${markerValue}, "Synthetic")})\n---\nFixture only\n`
}

describe('S1 executable frontmatter', () => {
  it('reads bare YAML without evaluating anything', async () => {
    const note = await getNote(vault, 'normal.md')
    assert.equal(note.frontmatter.title, 'Inside')
    assert.equal(note.frontmatter.type, 'Note')
    assert.match(note.content, /Inside fixture/)
  })

  it('reads ---yaml and ---json tags as data only', async () => {
    await writeFile(path.join(vault, 'tagged-yaml.md'), `---yaml\ntitle: Tagged YAML\n---\nBody yaml\n`)
    await writeFile(path.join(vault, 'tagged-json.md'), `---json\n{"title":"Tagged JSON","type":"Note"}\n---\nBody json\n`)

    const yamlNote = await getNote(vault, 'tagged-yaml.md')
    assert.equal(yamlNote.frontmatter.title, 'Tagged YAML')
    assert.match(yamlNote.content, /Body yaml/)

    const jsonNote = await getNote(vault, 'tagged-json.md')
    assert.equal(jsonNote.frontmatter.title, 'Tagged JSON')
    assert.equal(jsonNote.frontmatter.type, 'Note')
    assert.match(jsonNote.content, /Body json/)
  })

  it('does not execute javascript or js language tags on getNote', async () => {
    await writeFile(path.join(vault, 'language-tagged.md'), executableFrontmatter(1))
    delete globalThis[FRONTMATTER_MARK]
    const note = await getNote(vault, 'language-tagged.md')
    assert.equal(globalThis[FRONTMATTER_MARK], undefined)
    assert.equal(note.frontmatter.title, undefined)
    assert.match(note.content, /Fixture only|javascript/)
  })

  it('does not execute a ---js tag either', async () => {
    await writeFile(
      path.join(vault, 'js-tag.md'),
      `---js\n({title: (globalThis.${FRONTMATTER_MARK} = 9, "Synthetic")})\n---\nFixture only\n`,
    )
    delete globalThis[FRONTMATTER_MARK]
    const note = await getNote(vault, 'js-tag.md')
    assert.equal(globalThis[FRONTMATTER_MARK], undefined)
    assert.equal(note.frontmatter.title, undefined)
  })

  it('does not execute javascript frontmatter through vaultContext', async () => {
    await writeFile(path.join(vault, 'context-language-tagged.md'), executableFrontmatter(2))
    delete globalThis[FRONTMATTER_MARK]
    await vaultContext(vault)
    assert.equal(globalThis[FRONTMATTER_MARK], undefined)
  })

  it('treats unknown tags and malformed metadata as data, not engines', async () => {
    await writeFile(path.join(vault, 'unknown-tag.md'), `---toml\ntitle = "Nope"\n---\nPlain after\n`)
    await writeFile(path.join(vault, 'malformed.md'), `---\n: not a field\n---\nStill markdown\n`)
    await writeFile(path.join(vault, 'plain.md'), `# Just a heading\nNo fence\n`)

    const unknown = await getNote(vault, 'unknown-tag.md')
    assert.deepEqual(unknown.frontmatter, {})
    const malformed = await getNote(vault, 'malformed.md')
    assert.equal(malformed.frontmatter.title, undefined)
    assert.match(malformed.content, /Still markdown/)
    const plain = await getNote(vault, 'plain.md')
    assert.deepEqual(plain.frontmatter, {})
    assert.match(plain.content, /Just a heading/)
  })

  it('does not execute coffee or coffeescript language tags', async () => {
    await writeFile(
      path.join(vault, 'coffee.md'),
      `---coffee\nglobalThis.${FRONTMATTER_MARK} = 4\n---\nFixture only\n`,
    )
    await writeFile(
      path.join(vault, 'coffeescript.md'),
      `---coffeescript\nglobalThis.${FRONTMATTER_MARK} = 5\n---\nFixture only\n`,
    )
    delete globalThis[FRONTMATTER_MARK]
    const coffee = await getNote(vault, 'coffee.md')
    const script = await getNote(vault, 'coffeescript.md')
    assert.equal(globalThis[FRONTMATTER_MARK], undefined)
    assert.equal(coffee.frontmatter.title, undefined)
    assert.equal(script.frontmatter.title, undefined)
  })

  it('does not execute a ---cson tag either', async () => {
    await writeFile(
      path.join(vault, 'cson.md'),
      `---cson\nglobalThis.${FRONTMATTER_MARK} = 6\n---\nFixture only\n`,
    )
    delete globalThis[FRONTMATTER_MARK]
    const note = await getNote(vault, 'cson.md')
    assert.equal(globalThis[FRONTMATTER_MARK], undefined)
    assert.equal(note.frontmatter.title, undefined)
  })

  it('does not execute javascript through searchNotes', async () => {
    await writeFile(path.join(vault, 'search-tagged.md'), executableFrontmatter(5))
    delete globalThis[FRONTMATTER_MARK]
    await searchNotes(vault, 'Fixture')
    assert.equal(globalThis[FRONTMATTER_MARK], undefined)
  })

  it('does not execute javascript through the tool-service read', async () => {
    await writeFile(path.join(vault, 'service-tagged.md'), executableFrontmatter(3))
    const service = createMcpToolService({
      resolveVaultPaths: () => [vault],
    })
    delete globalThis[FRONTMATTER_MARK]
    const note = await service.readNote({ path: 'service-tagged.md', vaultPath: vault })
    assert.equal(globalThis[FRONTMATTER_MARK], undefined)
    assert.ok(note.content)
  })
})

describe('S2 vault symlink boundary', () => {
  it('rejects an external file symlink on getNote and omits it from search and context', async () => {
    symlinkSync(outside, path.join(vault, 'linked.md'))

    await assert.rejects(() => getNote(vault, 'linked.md'), { message: ACTIVE_VAULT_ERROR })

    const found = await searchNotes(vault, SENTINEL)
    assert.equal(found.some((row) => row.snippet.includes(SENTINEL) || row.title.includes(SENTINEL)), false)

    const context = await vaultContext(vault)
    assert.equal(context.recentNotes.some((row) => String(row.title).includes(SENTINEL)), false)
    assert.ok(context.recentNotes.some((row) => row.path === 'normal.md'))
  })

  it('does not read config/agents.md or AGENTS.md through external symlinks', async () => {
    symlinkSync(outside, path.join(vault, 'config', 'agents.md'))
    symlinkSync(outside, path.join(vault, 'AGENTS.md'))

    const context = await vaultContext(vault)
    assert.equal(Boolean(context.configFiles.agents?.includes(SENTINEL)), false)

    const instructions = await readAgentInstructions(vault)
    assert.equal(instructions, null)
  })

  it('rejects an external directory symlink used as config', async () => {
    const outsideDir = path.join(fixture, 'outside-config')
    await mkdir(outsideDir, { recursive: true })
    await writeFile(path.join(outsideDir, 'agents.md'), `# ${SENTINEL}\n`)
    await rm(path.join(vault, 'config'), { recursive: true, force: true })
    symlinkSync(outsideDir, path.join(vault, 'config'))

    const context = await vaultContext(vault)
    assert.equal(Boolean(context.configFiles.agents?.includes(SENTINEL)), false)
  })

  it('skips a broken symlink and still reads a nested normal note', async () => {
    symlinkSync(path.join(fixture, 'missing-target.md'), path.join(vault, 'broken.md'))
    const files = await findMarkdownFiles(vault)
    assert.equal(files.some((filePath) => filePath.endsWith('broken.md')), false)
    const nested = await getNote(vault, 'note/nested.md')
    assert.equal(nested.frontmatter.title, 'Nested')
  })

  it('does not treat a sibling-prefix directory as inside the vault', async () => {
    const twin = path.join(fixture, 'vault-extra')
    await mkdir(twin, { recursive: true })
    const twinNote = path.join(twin, 'secret.md')
    await writeFile(twinNote, `# ${SENTINEL}\n`)
    symlinkSync(twinNote, path.join(vault, 'twin.md'))

    await assert.rejects(() => getNote(vault, 'twin.md'), { message: ACTIVE_VAULT_ERROR })
    const found = await searchNotes(vault, SENTINEL)
    assert.equal(found.length, 0)
  })

  it('allows an in-vault symlink to another in-vault note', async () => {
    symlinkSync(path.join(vault, 'normal.md'), path.join(vault, 'alias.md'))
    const note = await getNote(vault, 'alias.md')
    assert.equal(note.frontmatter.title, 'Inside')
  })

  it('keeps createNote traversal rejected and a writable note readable', async () => {
    await assert.rejects(() => createNote(vault, '../escaped.md', 'Synthetic'), { message: ACTIVE_VAULT_ERROR })
    const created = await createNote(vault, 'note/writable.md', '# Writable\n')
    assert.equal(created.path, 'note/writable.md')
    const readBack = await getNote(vault, 'note/writable.md')
    assert.match(readBack.content, /Writable/)
  })

  it('skips a .md FIFO instead of hanging a reader', async () => {
    const fifoPath = path.join(vault, 'fifo.md')
    try {
      execFileSync('mkfifo', [fifoPath], { stdio: 'ignore' })
    } catch {
      return
    }
    const files = await Promise.race([
      findMarkdownFiles(vault),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('findMarkdownFiles hung on FIFO')), 1000)
      }),
    ])
    assert.equal(files.some((filePath) => filePath.endsWith('fifo.md')), false)
  })
})
