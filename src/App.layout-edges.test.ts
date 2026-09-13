import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')
const commandRail = readFileSync(`${process.cwd()}/src/components/CommandRail.tsx`, 'utf8')

describe('shell column edges', () => {
  it('uses the same inner divider on Notes as on the Sessions rail', () => {
    expect(commandRail).toContain("borderRight: '1px solid var(--border-subtle)'")
    expect(appCss).toMatch(/\.app__vault-panel\s*\{[^}]*border-left:\s*1px solid var\(--border-subtle\)/)
    expect(appCss).toMatch(/\.app__notes-rail\s*\{[^}]*border-left:\s*1px solid var\(--border-subtle\)/)
  })
})
