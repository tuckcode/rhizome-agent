import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { appendRhizomeEvent, DEFAULT_MCP_TRIGGER } from './vault-events.js'

let vault

beforeEach(async () => {
  vault = await mkdtemp(path.join(os.tmpdir(), 'rhizome-events-'))
})

afterEach(async () => {
  await rm(vault, { recursive: true, force: true })
})

async function readEvents() {
  const raw = await readFile(path.join(vault, '.rhizome/events.jsonl'), 'utf-8')
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

describe('appendRhizomeEvent', () => {
  // The invariant this module exists to enforce, shared with the Rust
  // writer (src-tauri/src/vault_events.rs, ADR-0161).
  it('puts type, trigger and timestamp on every record', async () => {
    appendRhizomeEvent(vault, { type: 'search', query: 'graphs' })

    const [event] = await readEvents()
    assert.equal(event.type, 'search')
    assert.equal(event.trigger, DEFAULT_MCP_TRIGGER)
    assert.ok(typeof event.timestamp === 'string' && event.timestamp.length > 0)
  })

  it('defaults trigger to mcp, since every caller arrives over MCP', async () => {
    appendRhizomeEvent(vault, { type: 'lint' })
    assert.equal((await readEvents())[0].trigger, 'mcp')
  })

  it('lets an explicit trigger win over the default', async () => {
    appendRhizomeEvent(vault, { type: 'distill', trigger: 'inbox' })
    assert.equal((await readEvents())[0].trigger, 'inbox')
  })

  // timestamp is spread last precisely so a caller cannot forge it.
  it('does not let a caller override timestamp', async () => {
    appendRhizomeEvent(vault, { type: 'distill', timestamp: 'not-a-real-time' })
    assert.notEqual((await readEvents())[0].timestamp, 'not-a-real-time')
  })

  it('carries kind-specific fields through', async () => {
    appendRhizomeEvent(vault, {
      type: 'research-started',
      mode: 'repo',
      repo: 'knispo/rhizome',
      depth: 'deep',
    })

    const [event] = await readEvents()
    assert.equal(event.mode, 'repo')
    assert.equal(event.repo, 'knispo/rhizome')
    assert.equal(event.depth, 'deep')
  })

  it('creates .rhizome when it does not exist', async () => {
    assert.equal(existsSync(path.join(vault, '.rhizome')), false)
    appendRhizomeEvent(vault, { type: 'graph-summary' })
    assert.ok(existsSync(path.join(vault, '.rhizome/events.jsonl')))
  })

  it('appends rather than truncating', async () => {
    appendRhizomeEvent(vault, { type: 'search' })
    appendRhizomeEvent(vault, { type: 'lint' })

    const events = await readEvents()
    assert.equal(events.length, 2)
    assert.equal(events[0].type, 'search')
    assert.equal(events[1].type, 'lint')
  })

  // Every line must parse on its own: the Rust reader now skips lines it
  // cannot parse, and the activity feed shows whatever survives.
  it('writes one self-contained JSON object per line', async () => {
    appendRhizomeEvent(vault, { type: 'search', query: 'a\nb "quoted"' })
    appendRhizomeEvent(vault, { type: 'lint' })

    const raw = await readFile(path.join(vault, '.rhizome/events.jsonl'), 'utf-8')
    const lines = raw.split('\n').filter((l) => l.length > 0)
    assert.equal(lines.length, 2)
    for (const line of lines) assert.doesNotThrow(() => JSON.parse(line))
  })
})
