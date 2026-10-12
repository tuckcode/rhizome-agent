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
const vendored = readFileSync(`${process.cwd()}/docs/vendored-sources.md`, 'utf8')
const identity = readFileSync(`${process.cwd()}/docs/IDENTITY.md`, 'utf8')
const gettingStarted = readFileSync(`${process.cwd()}/docs/GETTING-STARTED.md`, 'utf8')
const startReadme = readFileSync(`${process.cwd()}/docs/start/README.md`, 'utf8')
const preview = readFileSync(`${process.cwd()}/docs/PUBLIC-PREVIEW.md`, 'utf8')
const shipSkill = readFileSync(
  `${process.cwd()}/.cursor/skills/rhizome-ship/SKILL.md`,
  'utf8',
)

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
    expect(notices).toContain(
      'https://github.com/refactoringhq/portent-vault-template',
    )
    expect(notices).toContain('87c4adcb1ab031ec3b2eed9f0d3f5c61d6dc90bb')
    expect(notices).toContain('Used in: `src-tauri/src/vault/config_seed.rs`')
    expect(notices).toContain('Copyright (c) 2026 Refactoring')
    expect(notices).not.toMatch(/No Portent specification text is copied/)
    expect(notices).not.toMatch(/Portent favors convention/)
    expect(vendored).toContain('src-tauri/src/vault/config_seed.rs')
    expect(vendored).toContain('refactoringhq/portent-vault-template')
    expect(vendored).toContain('87c4adcb1ab031ec3b2eed9f0d3f5c61d6dc90bb')
  })

  it('installs Rhizome.app and archives the old Agent.app name', () => {
    expect(gettingStarted).toContain('`ai.rhizome.agent` / `Rhizome.app`')
    expect(gettingStarted).toContain('/Applications/Rhizome.app')
    expect(gettingStarted).not.toContain('Rhizome Agent.app')
    expect(startReadme).toContain('/Applications/Rhizome.app')
    expect(startReadme).not.toContain('Rhizome Agent.app')
    expect(preview).toContain('/Applications/Rhizome.app')
    expect(preview).not.toContain('Rhizome Agent.app')
    expect(shipSkill).toContain('/Applications/Rhizome.app')
    expect(shipSkill).toContain('~/Documents/Rhizome\\ archives')
    expect(shipSkill).toMatch(/mv "\/Applications\/Rhizome Agent\.app"/)
  })

  it('says the repo is public AGPL-3.0 and names the GitHub repo', () => {
    expect(en).toContain(
      '"feedback.sponsor.description": "This repository is public under AGPL-3.0. Issues and pull requests are welcome. The source is at github.com/tuckcode/rhizome-agent."',
    )
    expect(en).not.toContain('private fork')
    expect(en).not.toContain('not open for outside contributions')
  })

  it('says API keys go in the system keychain, not Rhizome files', () => {
    expect(en).toContain(
      '"settings.aiProviders.keyStorage.local": "Save in your system keychain."',
    )
    expect(en).toContain(
      'Provider API keys are stored in the system keychain, not in Rhizome\'s files.',
    )
    expect(en).not.toContain('Rhizome does not store provider API keys.')
  })
})
