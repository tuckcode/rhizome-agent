import { describe, expect, it } from 'vitest'
import type { VaultOption } from '../components/status-bar/types'
import { buildAllVaults } from './vaultCollections'

const defaultVault: VaultOption = { label: 'Getting Started', path: '/getting-started', managedDefault: true }
const workVault: VaultOption = { label: 'Work', path: '/work' }

describe('vaultCollections', () => {
  it('keeps the managed default first until users persist a custom order', () => {
    expect(buildAllVaults({
      visibleDefaults: [defaultVault],
      extraVaults: [workVault],
      hiddenDefaults: [],
    })).toEqual([defaultVault, workVault])
  })

  it('uses persisted order when it includes the managed default', () => {
    expect(buildAllVaults({
      visibleDefaults: [defaultVault],
      extraVaults: [workVault, { ...defaultVault, managedDefault: undefined }],
      hiddenDefaults: [],
    })).toEqual([workVault, defaultVault])
  })

  it('keeps hidden managed defaults out of persisted order', () => {
    expect(buildAllVaults({
      visibleDefaults: [],
      extraVaults: [workVault, defaultVault],
      hiddenDefaults: [defaultVault.path],
    })).toEqual([workVault])
  })
})
