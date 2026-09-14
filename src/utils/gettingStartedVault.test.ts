import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  GETTING_STARTED_VAULT_NAME,
  RHIZOME_VAULT_DEFAULT_NAME,
  buildEmptyVaultPath,
  buildGettingStartedVaultPath,
  sanitizeVaultFolderName,
  formatGettingStartedCloneError,
  labelFromPath,
} from './gettingStartedVault'

describe('gettingStartedVault', () => {
  it('builds a child vault path from a parent folder', () => {
    expect(buildGettingStartedVaultPath('/Users/luca/Documents')).toBe('/Users/luca/Documents/Getting Started')
  })

  it('trims trailing separators when building the child vault path', () => {
    expect(buildGettingStartedVaultPath('/Users/luca/Documents/')).toBe('/Users/luca/Documents/Getting Started')
  })

  it('preserves windows separators when building the child vault path', () => {
    expect(buildGettingStartedVaultPath('C:\\Users\\luca\\Documents\\')).toBe('C:\\Users\\luca\\Documents\\Getting Started')
  })

  it('builds a default "Rhizome Vault" child path for new empty vaults', () => {
    expect(buildEmptyVaultPath('/Users/luca/Documents')).toBe('/Users/luca/Documents/Rhizome Vault')
  })

  it('trims trailing separators when building the empty-vault child path', () => {
    expect(buildEmptyVaultPath('/Users/luca/Documents/')).toBe('/Users/luca/Documents/Rhizome Vault')
  })

  it('preserves windows separators when building the empty-vault child path', () => {
    expect(buildEmptyVaultPath('C:\\Users\\luca\\Documents\\')).toBe('C:\\Users\\luca\\Documents\\Rhizome Vault')
  })

  it('derives a label matching the default name from the final path segment', () => {
    expect(labelFromPath('/Users/luca/Documents/Rhizome Vault')).toBe(RHIZOME_VAULT_DEFAULT_NAME)
  })

  it('derives a label from the final path segment', () => {
    expect(labelFromPath('/Users/luca/Documents/Getting Started')).toBe(GETTING_STARTED_VAULT_NAME)
  })

  it('passes through destination errors verbatim', () => {
    expect(formatGettingStartedCloneError("Destination '/tmp/Getting Started' already exists and is not empty"))
      .toBe("Destination '/tmp/Getting Started' already exists and is not empty")
  })

  it('maps git-not-found clone failures to an installation message', () => {
    expect(formatGettingStartedCloneError('Failed to run git clone: The system cannot find the file specified. (os error 2)'))
      .toBe('Git is required to download the Getting Started vault. Install Git and try again.')
  })

  it('maps concrete network clone failures to the connection message', () => {
    expect(formatGettingStartedCloneError('git clone failed: fatal: unable to access: Could not resolve host: github.com'))
      .toBe('Could not download Getting Started vault. Check your connection and try again.')
  })

  it('preserves unexpected clone failure details', () => {
    expect(formatGettingStartedCloneError('git clone failed: fatal: unable to access'))
      .toBe('Could not download Getting Started vault: git clone failed: fatal: unable to access')
  })

  it('first-run rust still seeds folders only — no personal notes', () => {
    const source = readFileSync(
      `${process.cwd()}/src-tauri/src/vault/getting_started.rs`,
      'utf8',
    )
    expect(source).toContain('structure only, no personal notes')
    expect(source).toContain('"inbox"')
    expect(source).toContain('"projects"')
    expect(source).toContain('"Imports"')
    expect(source).toContain('welcome.md')
  })

  it('names a local scaffold failure as create, not download', () => {
    expect(
      formatGettingStartedCloneError(
        "Failed to create Getting Started folder '/tmp/Getting Started': Permission denied",
      ),
    ).toBe(
      "Could not create Getting Started vault: Failed to create Getting Started folder '/tmp/Getting Started': Permission denied",
    )
  })

  it('keeps git permission-denied clone failures as a GitHub access message', () => {
    expect(formatGettingStartedCloneError('git clone failed: Permission denied (publickey)')).toBe(
      'Could not download Getting Started vault. Check your GitHub access and try again.',
    )
  })
})

describe('sanitizeVaultFolderName', () => {
  it('keeps a normal name unchanged', () => {
    expect(sanitizeVaultFolderName('Work Notes')).toBe('Work Notes')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeVaultFolderName('  Work Notes  ')).toBe('Work Notes')
  })

  it('falls back to the default when the name is empty or whitespace', () => {
    expect(sanitizeVaultFolderName('')).toBe(RHIZOME_VAULT_DEFAULT_NAME)
    expect(sanitizeVaultFolderName('   ')).toBe(RHIZOME_VAULT_DEFAULT_NAME)
  })

  it('strips path separators so a name cannot escape the chosen parent folder', () => {
    expect(sanitizeVaultFolderName('../../etc')).toBe('etc')
    expect(sanitizeVaultFolderName('a/b')).toBe('ab')
    expect(sanitizeVaultFolderName('a\\b')).toBe('ab')
  })

  it('strips characters that are invalid in Windows folder names', () => {
    expect(sanitizeVaultFolderName('My:Vault?*"<>|')).toBe('MyVault')
  })

  it('falls back to the default when sanitizing removes everything', () => {
    expect(sanitizeVaultFolderName('///')).toBe(RHIZOME_VAULT_DEFAULT_NAME)
  })
})

describe('buildEmptyVaultPath with a custom name', () => {
  it('uses the provided name', () => {
    expect(buildEmptyVaultPath('/Users/luca/Documents', 'Work Notes')).toBe('/Users/luca/Documents/Work Notes')
  })

  it('sanitizes the provided name before appending it', () => {
    expect(buildEmptyVaultPath('/Users/luca/Documents', '../escape')).toBe('/Users/luca/Documents/escape')
  })

  it('falls back to the default name when given only whitespace', () => {
    expect(buildEmptyVaultPath('/Users/luca/Documents', '  ')).toBe('/Users/luca/Documents/Rhizome Vault')
  })
})
