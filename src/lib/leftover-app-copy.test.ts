import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
const tauri = readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8')
const cargo = readFileSync(`${process.cwd()}/src-tauri/Cargo.toml`, 'utf8')
const config = readFileSync(`${process.cwd()}/src-tauri/src/app_config.rs`, 'utf8')
const keys = readFileSync(`${process.cwd()}/src-tauri/src/provider_keys.rs`, 'utf8')
const protocol = readFileSync(
  `${process.cwd()}/src-tauri/src/acp_client/protocol.rs`,
  'utf8',
)
const notices = readFileSync(`${process.cwd()}/THIRD_PARTY_NOTICES`, 'utf8')
const identity = readFileSync(`${process.cwd()}/docs/IDENTITY.md`, 'utf8')

describe('leftover app copy — Rhizome name, kept paths', () => {
  it('uses Rhizome as the user-facing product name', () => {
    expect(tauri).toContain('"productName": "Rhizome"')
    expect(tauri).toContain('"title": "Rhizome"')
    expect(protocol).toContain('pub(crate) const CLIENT_TITLE: &str = "Rhizome"')
    expect(identity).toContain('user-facing product name is **Rhizome**')
  })

  it('keeps identifier, keychain, config dir, and Cargo binary', () => {
    expect(tauri).toContain('"identifier": "ai.rhizome.agent"')
    expect(keys).toContain('pub const KEYCHAIN_SERVICE: &str = "ai.rhizome.agent"')
    expect(config).toContain('const APP_CONFIG_DIR: &str = "com.rhizome.app"')
    expect(cargo).toContain('name = "RhizomeAgent"')
    expect(cargo).toContain('default-run = "RhizomeAgent"')
  })

  it('credits Portent as the vault structure template', () => {
    expect(en).toContain(
      'The default vault structure comes from the Portent template.',
    )
    expect(notices).toContain('Used as: the vault structure template')
    expect(notices).not.toMatch(/Portent favors convention/)
  })

  it('says the repo is public AGPL-3.0 and names the GitHub repo', () => {
    expect(en).toContain(
      '"feedback.sponsor.description": "This repository is public under AGPL-3.0. Issues and pull requests are welcome. The source is at github.com/tuckcode/rhizome-agent."',
    )
    expect(en).not.toContain('private fork')
    expect(en).not.toContain('not open for outside contributions')
  })

  it('says API keys go in the macOS / OS keychain', () => {
    expect(en).toContain(
      '"settings.aiProviders.keyStorage.local": "Store in the macOS keychain (on other platforms, the OS keychain)"',
    )
  })
})
