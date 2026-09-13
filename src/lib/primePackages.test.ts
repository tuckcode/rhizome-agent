import { describe, expect, it } from 'vitest'
import {
  catalogSearchUrl,
  parseInstalledPrimePackages,
  parseNpmSearchResponse,
  primePackageInstallCommand,
} from './primePackages'

describe('primePackageInstallCommand', () => {
  it('uses Prime CLI, not the Pi website short form', () => {
    expect(primePackageInstallCommand('pi-mcp-adapter')).toBe(
      'prime-agent package install npm:pi-mcp-adapter',
    )
  })

  it('keeps npm git http and path specs as written', () => {
    expect(primePackageInstallCommand('npm:@foo/bar@1.0.0')).toBe(
      'prime-agent package install npm:@foo/bar@1.0.0',
    )
    expect(primePackageInstallCommand('git:github.com/user/repo@v1')).toBe(
      'prime-agent package install git:github.com/user/repo@v1',
    )
    expect(primePackageInstallCommand('/absolute/path')).toBe(
      'prime-agent package install /absolute/path',
    )
  })
})

describe('parseInstalledPrimePackages', () => {
  it('reads string and object package entries from Prime settings', () => {
    expect(parseInstalledPrimePackages({
      packages: [
        'pi-skills',
        { source: 'npm:@org/my-extension', extensions: [] },
        '  ',
        { source: 'pi-skills' },
      ],
    })).toEqual([
      { source: 'pi-skills' },
      { source: 'npm:@org/my-extension' },
    ])
  })

  it('returns empty when packages are missing', () => {
    expect(parseInstalledPrimePackages({})).toEqual([])
    expect(parseInstalledPrimePackages(null)).toEqual([])
  })
})

describe('parseNpmSearchResponse', () => {
  it('keeps public catalog fields and drops publisher email', () => {
    const parsed = parseNpmSearchResponse({
      total: 9724,
      objects: [{
        downloads: { monthly: 904127 },
        package: {
          name: 'pi-mcp-adapter',
          description: 'MCP adapter extension for Pi coding agent',
          keywords: ['pi-package', 'extension'],
          publisher: { username: 'nicopreme', email: 'secret@example.com' },
          links: { npm: 'https://www.npmjs.com/package/pi-mcp-adapter' },
        },
      }],
    })
    expect(parsed.total).toBe(9724)
    expect(parsed.hits).toEqual([{
      name: 'pi-mcp-adapter',
      description: 'MCP adapter extension for Pi coding agent',
      publisher: 'nicopreme',
      downloadsMonthly: 904127,
      npmUrl: 'https://www.npmjs.com/package/pi-mcp-adapter',
      kinds: ['extension'],
    }])
    expect(JSON.stringify(parsed)).not.toContain('secret@example.com')
  })
})

describe('catalogSearchUrl', () => {
  it('always filters to the pi-package keyword', () => {
    expect(catalogSearchUrl('')).toContain('keywords%3Api-package')
    expect(catalogSearchUrl('memory')).toContain('memory')
    expect(catalogSearchUrl('memory')).toContain('keywords%3Api-package')
  })

  it('narrows the catalog by kind', () => {
    expect(catalogSearchUrl('', 'skill')).toContain('keywords%3Askill')
    expect(catalogSearchUrl('memory', 'extension')).toContain('keywords%3Aextension')
    expect(catalogSearchUrl('', 'all')).not.toContain('keywords%3Askill')
  })
})
