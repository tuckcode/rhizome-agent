import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover chat stays', () => {
  const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
  const rail = readFileSync(
    `${process.cwd()}/src/components/CommandRail.tsx`,
    'utf8',
  )

  it('keeps ChatHome in App', () => {
    expect(app).toContain('<ChatHome')
  })

  it('does not put Notes on the command rail', () => {
    expect(rail).not.toContain('command-rail-inbox')
    expect(rail).not.toContain('active={notesOpen}')
  })

  it('does not hide Chat when Notes is open', () => {
    expect(app).toContain('{chatHomeSurface}')
    expect(app).not.toMatch(/notesOpen \? null[\s\S]{0,80}chatHomeSurface/)
  })
})
