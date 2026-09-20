import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { symlinkSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isHomeVaultPath, requireVaultPaths } from './vault-path.js'

describe('vault-path HOME aliases', () => {
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
})
