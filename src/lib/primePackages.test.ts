import { describe, expect, it } from 'vitest'
import {
  catalogSearchUrl,
  isPrimeCliMissing,
  isPrimePackageInstalled,
  parseInstalledPrimePackages,
  parseNpmSearchResponse,
  primePackageAskAgentPrompt,
  primePackageInstallCommand,
  primePackageInstallSpec,
} from './primePackages'

describe('primePackageInstallSpec', () => {
  it('prefixes bare catalog names with npm:', () => {
    expect(primePackageInstallSpec('pi-mcp-adapter')).toBe('npm:pi-mcp-adapter')
  })

  it('keeps npm git http ssh and path specs as written', () => {
    expect(primePackageInstallSpec('npm:@foo/bar@1.0.0')).toBe('npm:@foo/bar@1.0.0')
    expect(primePackageInstallSpec('git:github.com/user/repo@v1')).toBe(
      'git:github.com/user/repo@v1',
    )
    expect(primePackageInstallSpec('https://github.com/user/repo')).toBe(
      'https://github.com/user/repo',
    )
    expect(primePackageInstallSpec('ssh://git@github.com:user/repo')).toBe(
      'ssh://git@github.com:user/repo',
    )
    expect(primePackageInstallSpec('/absolute/path')).toBe('/absolute/path')
  })
})

describe('isPrimePackageInstalled', () => {
  it('treats a catalog name as installed when settings list npm:name', () => {
    expect(isPrimePackageInstalled('pi-mcp-adapter', [
      { source: 'npm:pi-mcp-adapter' },
    ])).toBe(true)
    expect(isPrimePackageInstalled('pi-web-access', [
      { source: 'npm:pi-mcp-adapter' },
    ])).toBe(false)
  })

  it('ignores a pinned npm version when matching', () => {
    expect(isPrimePackageInstalled('npm:@foo/bar', [
      { source: 'npm:@foo/bar@1.2.3' },
    ])).toBe(true)
  })
})

describe('isPrimeCliMissing', () => {
  it('recognises the host messages for a missing Prime binary', () => {
    expect(isPrimeCliMissing('Prime is not installed. Install it with `npm i -g prime-agent`.')).toBe(true)
    expect(isPrimeCliMissing('Prime Agent not found. Install it: npm i -g prime-agent')).toBe(true)
    expect(isPrimeCliMissing('Could not install npm:foo. network error')).toBe(false)
  })
})

describe('primePackageAskAgentPrompt', () => {
  it('asks Chat to run the Prime CLI, not the Pi website short form', () => {
    expect(primePackageAskAgentPrompt('pi-mcp-adapter')).toContain(
      'prime-agent package install npm:pi-mcp-adapter',
    )
    expect(primePackageAskAgentPrompt('pi-mcp-adapter')).not.toContain('pi install ')
  })
})

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
