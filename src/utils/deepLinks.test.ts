import { describe, expect, it } from 'vitest'
import {
  buildRhizomeDeepLinkForEntry,
  parseRhizomeDeepLink,
  relativePathForVaultItem,
  resolveRhizomeDeepLink,
  RHIZOME_DEEP_LINK_SCHEME,
  vaultDeepLinkSlug,
  type DeepLinkVault,
} from './deepLinks'

const workVault: DeepLinkVault = {
  label: 'Work Vault',
  path: '/Users/luca/Work Vault',
}

const personalVault: DeepLinkVault = {
  label: 'Personal Vault',
  path: '/Users/luca/Personal Vault',
}

describe('Rhizome deep links', () => {
  // Every test in this file builds/parses URLs using RHIZOME_DEEP_LINK_SCHEME,
  // so a self-consistent constant would pass all of them even if it drifted
  // from what the OS actually delivers. This anchors it to the one thing
  // that matters: src-tauri/tauri.conf.json's registered scheme. Before
  // ADR-0162 this constant was "tolaria" while tauri.conf.json already said
  // "rhizome" — every deep link the OS delivered was silently rejected as
  // invalid_scheme, and nothing here caught it.
  it('matches the scheme registered in tauri.conf.json', () => {
    expect(RHIZOME_DEEP_LINK_SCHEME).toBe('rhizome')
  })


  it('builds readable links with extensions and encoded path segments', () => {
    const result = buildRhizomeDeepLinkForEntry({
      entry: { path: '/Users/luca/Work Vault/sponsorships/Acme call #1.md' },
      vaultPath: workVault.path,
      vaults: [workVault],
    })

    expect(result).toEqual({
      ok: true,
      url: 'rhizome://work-vault/sponsorships/Acme%20call%20%231.md',
    })
  })

  it('round-trips unicode and URL-reserved path characters', () => {
    const url = 'rhizome://work-vault/books/Caf%C3%A9%20%26%20notes%3F%25.md'
    expect(parseRhizomeDeepLink({ rawUrl: url })).toEqual({
      ok: true,
      relativePath: 'books/Café & notes?%.md',
      slug: 'work-vault',
      url,
    })
  })

  it('appends stable path hashes when vault slugs collide', () => {
    const first = { label: 'Work', path: '/Users/luca/One' }
    const second = { label: 'Work', path: '/Users/luca/Two' }

    const firstSlug = vaultDeepLinkSlug(first, [first, second])
    const secondSlug = vaultDeepLinkSlug(second, [first, second])

    expect(firstSlug).toMatch(/^work-[a-z0-9]{6}$/)
    expect(secondSlug).toMatch(/^work-[a-z0-9]{6}$/)
    expect(firstSlug).not.toBe(secondSlug)
  })

  it('resolves generated collision-safe slugs without opening the wrong vault', () => {
    const first = { label: 'Work', path: '/Users/luca/One' }
    const second = { label: 'Work', path: '/Users/luca/Two' }
    const slug = vaultDeepLinkSlug(second, [first, second])

    expect(resolveRhizomeDeepLink({ rawUrl: `rhizome://${slug}/note.md`, vaults: [first, second] })).toEqual({
      ok: true,
      absolutePath: '/Users/luca/Two/note.md',
      relativePath: 'note.md',
      vault: second,
    })
  })

  it('rejects ambiguous handwritten base slugs', () => {
    const first = { label: 'Work', path: '/Users/luca/One' }
    const second = { label: 'Work', path: '/Users/luca/Two' }

    expect(resolveRhizomeDeepLink({ rawUrl: 'rhizome://work/note.md', vaults: [first, second] })).toEqual({
      ok: false,
      error: 'ambiguous_vault',
    })
  })

  it('rejects unknown and unavailable vaults', () => {
    expect(resolveRhizomeDeepLink({ rawUrl: 'rhizome://missing/note.md', vaults: [workVault] })).toEqual({
      ok: false,
      error: 'unknown_vault',
    })
    expect(resolveRhizomeDeepLink({
      rawUrl: 'rhizome://work-vault/note.md',
      vaults: [{ ...workVault, available: false }],
    })).toEqual({
      ok: false,
      error: 'unavailable_vault',
    })
  })

  it('rejects path traversal and encoded separators', () => {
    expect(parseRhizomeDeepLink({ rawUrl: 'rhizome://work-vault/../secret.md' })).toEqual({
      ok: false,
      error: 'unsafe_path',
    })
    expect(parseRhizomeDeepLink({ rawUrl: 'rhizome://work-vault/folder%2Fsecret.md' })).toEqual({
      ok: false,
      error: 'unsafe_path',
    })
  })

  it('requires target files to stay inside a known vault root', () => {
    expect(relativePathForVaultItem({
      itemPath: '/Users/luca/Work Vault/docs/adr/0129.md',
      vaultPath: workVault.path,
    })).toBe('docs/adr/0129.md')
    expect(relativePathForVaultItem({
      itemPath: '/Users/luca/Work Vaults/docs/adr/0129.md',
      vaultPath: workVault.path,
    })).toBeNull()
    expect(buildRhizomeDeepLinkForEntry({
      entry: { path: '/Users/luca/Personal Vault/note.md' },
      vaultPath: workVault.path,
      vaults: [workVault, personalVault],
    })).toEqual({
      ok: false,
      error: 'outside_vault',
    })
  })
})
