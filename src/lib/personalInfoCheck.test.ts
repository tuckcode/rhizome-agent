import { describe, expect, it } from 'vitest'
import { findPersonalInfo } from '../../scripts/check-personal-info.mjs'

// Inputs are assembled from parts so this file never holds a literal
// home path or address the pre-commit check would flag.
const WIN_HOME = ['C:', 'Users', 'jdoe'].join('\\')
const MAC_HOME = ['', 'Users', 'jdoe', ''].join('/')
const LINUX_HOME = ['', 'home', 'jdoe', ''].join('/')
const GMAIL = ['jdoe', 'gmail.com'].join('@')
const OPTIONS = { names: ['jdoe'] }

function diffAdding(file: string, ...lines: string[]): string {
  return [
    `diff --git a/${file} b/${file}`,
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map(line => `+${line}`),
  ].join('\n')
}

describe('findPersonalInfo', () => {
  it('flags a Windows home path with file and line', () => {
    const findings = findPersonalInfo(diffAdding('docs/a.md', 'ok', `see ${WIN_HOME}\\Downloads`), OPTIONS)
    expect(findings).toEqual([
      { file: 'docs/a.md', line: 2, kind: 'home path', text: `see ${WIN_HOME}\\Downloads` },
    ])
  })

  it('flags macOS and Linux home paths and personal email', () => {
    const kinds = findPersonalInfo(
      diffAdding('x.md', `${MAC_HOME}code`, `${LINUX_HOME}code`, `mail ${GMAIL}`),
      OPTIONS,
    ).map(f => f.kind)
    expect(kinds).toEqual(['home path', 'home path', 'personal email'])
  })

  it('ignores removed and context lines', () => {
    const diff = ['+++ b/x.md', '@@ -1,2 +1,1 @@', `-${WIN_HOME}`, ` ${WIN_HOME}`].join('\n')
    expect(findPersonalInfo(diff, OPTIONS)).toEqual([])
  })

  it('allows placeholders and fixture names', () => {
    const fine = [
      '~/Documents/Vault',
      '%LOCALAPPDATA%\\Rhizome',
      ['C:', 'Users', '<you>', 'Vault'].join('\\'),
      ['', 'Users', 'mock', 'vault'].join('/'),
      ['', 'home', 'user', 'vault'].join('/'),
      ['noreply', 'anthropic.com'].join('@'),
    ]
    expect(findPersonalInfo(diffAdding('x.md', ...fine), OPTIONS)).toEqual([])
  })

  it('flags only the listed names, so made-up fixture homes pass', () => {
    const fixture = ['C:', 'Users', 'alex', 'npm'].join('\\')
    expect(findPersonalInfo(diffAdding('x.rs', fixture), OPTIONS)).toEqual([])
  })

  it('matches names case-insensitively', () => {
    const upper = ['C:', 'Users', 'JDoe', 'npm'].join('\\')
    expect(findPersonalInfo(diffAdding('x.md', upper), OPTIONS)).toHaveLength(1)
  })

  it('skips a line carrying the allow marker', () => {
    expect(findPersonalInfo(diffAdding('x.md', `${WIN_HOME} personal-info: allow`), OPTIONS)).toEqual([])
  })

  it('counts line numbers from each hunk start', () => {
    const diff = ['+++ b/x.md', '@@ -10,0 +41,2 @@', '+ok', `+${MAC_HOME}`].join('\n')
    expect(findPersonalInfo(diff, OPTIONS)[0].line).toBe(42)
  })
})
