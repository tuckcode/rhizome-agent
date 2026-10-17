import { readFileSync } from 'node:fs'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

const ALPHA_UPDATE_FEED =
  'https://github.com/tuckcode/rhizome-agent/releases/download/alpha-latest/alpha-latest.json'

describe('Tauri updater configuration', () => {
  it('points the app at the moving alpha feed and a placeholder pubkey', () => {
    const config = JSON.parse(readFileSync(`${cwd()}/src-tauri/tauri.conf.json`, 'utf8')) as {
      bundle: { createUpdaterArtifacts: boolean }
      plugins: { updater: { endpoints: string[]; pubkey: string } }
    }

    expect(config.bundle.createUpdaterArtifacts).toBe(true)
    expect(config.plugins.updater.endpoints).toEqual([ALPHA_UPDATE_FEED])
    expect(config.plugins.updater.endpoints[0]).not.toContain('/releases/latest/')
    expect(config.plugins.updater.pubkey).toBe('PLACEHOLDER_KNISPO_TAURI_UPDATER_PUBKEY')
  })
})
