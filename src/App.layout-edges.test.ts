import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')
const commandRail = readFileSync(`${process.cwd()}/src/components/CommandRail.tsx`, 'utf8')

describe('shell column edges', () => {
  it('keeps a faint Sessions rail so Chat can pulse its working strip', () => {
    expect(commandRail).toContain("borderRight: '1px solid var(--border-subtle)'")
    expect(commandRail).not.toContain("borderRight: '1px solid var(--sidebar-border)'")
  })

  it('keeps a visible inner divider on Notes', () => {
    expect(appCss).toMatch(/\.app__vault-panel\s*\{[^}]*border-left:\s*1px solid var\(--sidebar-border\)/)
    expect(appCss).toMatch(/\.app__notes-rail\s*\{[^}]*border-left:\s*1px solid var\(--sidebar-border\)/)
  })
})
