import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runGraphSummary } from './ws-bridge.js'

const bridgeSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'ws-bridge.js'),
  'utf8',
)

describe('ws-bridge rhizome_graph_summary (C40)', () => {
  it('keeps the tool name and does not name the external rhizome-graph CLI', () => {
    assert.match(bridgeSource, /\['rhizome_graph_summary',\s*\(args\)\s*=>\s*runGraphSummary\(args\)\]/)
    assert.equal(bridgeSource.includes("'rhizome-graph'"), false)
    assert.equal(bridgeSource.includes('"rhizome-graph"'), false)
  })

  it('runs in-repo graph-query health and does not spawn rhizome-graph', async () => {
    let spawned = null
    const result = await runGraphSummary(
      { vaultPath: '/vault' },
      {
        toolPath: '/opt/rhizome-tool',
        activeVaultPaths: () => ['/vault'],
        execFileSync: (file, args) => {
          spawned = { file, args }
          return '{"notes":1,"links":1,"deadLinks":1,"uncreated":1,"orphans":0}\n'
        },
      },
    )

    assert.deepEqual(spawned, {
      file: '/opt/rhizome-tool',
      args: ['graph-query', '/vault', 'health'],
    })
    assert.equal(spawned.file.includes('rhizome-graph'), false)
    assert.equal(spawned.args.includes('summary'), false)
    assert.equal(JSON.parse(result.result).deadLinks, 1)
  })

  it('names the missing sidecar and does not spawn a CLI', async () => {
    let spawned = false
    const result = await runGraphSummary(
      { vaultPath: '/vault' },
      {
        toolPath: '',
        activeVaultPaths: () => ['/vault'],
        execFileSync: () => {
          spawned = true
          return ''
        },
      },
    )

    assert.equal(spawned, false)
    assert.match(result.error, /RHIZOME_TOOL_PATH/)
  })

  it('refuses a vault that is not active without spawning', async () => {
    let spawned = false
    const result = await runGraphSummary(
      { vaultPath: '/other' },
      {
        toolPath: '/opt/rhizome-tool',
        activeVaultPaths: () => ['/vault'],
        execFileSync: () => {
          spawned = true
          return ''
        },
      },
    )

    assert.equal(spawned, false)
    assert.deepEqual(result, { error: 'Vault path is not active' })
  })
})
