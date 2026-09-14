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

  it('marks Notes pressed from notesOpen', () => {
    expect(rail).toContain('active={notesOpen}')
  })

  it('does not hide Chat when Notes is open', () => {
    expect(app).toContain('{chatHomeSurface}')
    expect(app).not.toMatch(/notesOpen \? null[\s\S]{0,80}chatHomeSurface/)
  })
})
