import { describe, expect, it } from 'vitest'
import { mockHandlers } from './mock-handlers'

describe('mockHandlers git remote state', () => {
  it('keeps starter vaults local-only until a remote is added', () => {
    const vaultPath = '/Users/mock/Documents/Getting Started Test'

    expect(mockHandlers.create_getting_started_vault({ targetPath: vaultPath })).toBe(vaultPath)
    expect(mockHandlers.git_remote_status({ vaultPath }).hasRemote).toBe(false)

    expect(
      mockHandlers.git_add_remote({
        request: {
          vaultPath,
          remoteUrl: 'https://example.com/starter.git',
        },
      }).status,
    ).toBe('connected')

    expect(mockHandlers.git_remote_status({ vaultPath }).hasRemote).toBe(true)
  })

  it('starts empty vaults without a remote and keeps cloned vaults remote-backed', () => {
    const emptyVaultPath = '/Users/mock/Documents/Local Vault'
    const clonedVaultPath = '/Users/mock/Documents/Cloned Vault'

    expect(mockHandlers.create_empty_vault({ targetPath: emptyVaultPath })).toBe(emptyVaultPath)
    expect(mockHandlers.git_remote_status({ vaultPath: emptyVaultPath }).hasRemote).toBe(false)

    expect(mockHandlers.clone_repo({ url: 'https://example.com/repo.git', localPath: clonedVaultPath })).toContain(clonedVaultPath)
    expect(mockHandlers.git_remote_status({ vaultPath: clonedVaultPath }).hasRemote).toBe(true)
  })
})
