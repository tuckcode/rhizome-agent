import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const preview = readFileSync(`${process.cwd()}/docs/PUBLIC-PREVIEW.md`, 'utf8')
const gettingStarted = readFileSync(
  `${process.cwd()}/docs/GETTING-STARTED.md`,
  'utf8',
)
const readme = readFileSync(`${process.cwd()}/README.md`, 'utf8')
const handoff = readFileSync(`${process.cwd()}/docs/HANDOFF.md`, 'utf8')

describe('leftover public-preview install claims', () => {
  it('does not claim that product and planning commits were pushed together', () => {
    for (const text of [preview, gettingStarted, handoff]) {
      expect(text).not.toMatch(/Both were pushed together/)
      expect(text).not.toMatch(/product and planning commits were pushed together/)
    }
  })

  it('documents Vite 5202 and rejects Node 18 as the app prerequisite', () => {
    expect(preview).toContain('http://localhost:5202')
    expect(gettingStarted).toContain('http://localhost:5202')
    expect(readme).toContain('http://localhost:5202')
    expect(preview).toContain('^20.19.0')
    expect(gettingStarted).toContain('^20.19.0')
    expect(gettingStarted).not.toMatch(/\*\*Node\.js\*\* 18\+/)
    expect(gettingStarted).not.toMatch(/Open http:\/\/localhost:5173/)
    expect(gettingStarted).not.toContain('BASE_URL="http://localhost:5173"')
  })

  it('reuses the C75 hide correction and keeps #66 closed', () => {
    expect(preview).toContain('ws-bridge')
    expect(preview).toContain('Mindwalk')
    expect(preview).toMatch(/Prime daemon stays warm/)
    expect(gettingStarted).toContain(
      'Hide stops ws-bridge and Mindwalk, not spawned Prime',
    )
    expect(preview).toContain('Do not reopen them')
    expect(preview).toContain('to merge')
    expect(readme).toContain('PR #66')
  })

  it('records the confirmed license and upstream credit, not a legal determination', () => {
    // Atticus confirmed AGPL-3.0-or-later for the public release on 2026-09-26.
    expect(readme).toContain('AGPL-3.0-or-later')
    expect(readme).toContain('confirmed this on\n2026-09-26')
    expect(readme).toContain('by Luca Rossi (AGPL-3.0)')
    expect(preview).toContain('not a legal determination')
    expect(preview).toContain('Mindwalk (MIT) © 2026 Ricko Yu')
  })
})
