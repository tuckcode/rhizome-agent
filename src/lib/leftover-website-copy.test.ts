import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const landing = readFileSync(`${process.cwd()}/website/index.html`, 'utf8')
const readme = readFileSync(`${process.cwd()}/README.md`, 'utf8')
const preview = readFileSync(`${process.cwd()}/docs/PUBLIC-PREVIEW.md`, 'utf8')
const start = readFileSync(`${process.cwd()}/docs/start/README.md`, 'utf8')

describe('leftover website and preview copy', () => {
  it('does not describe Prime as the harness', () => {
    for (const text of [landing, readme, preview, start]) {
      expect(text).not.toMatch(/built around Prime Agent/)
      expect(text).not.toMatch(/A chat app for Prime Agent/)
      expect(text).not.toMatch(/Chat needs Prime/)
      expect(text).not.toMatch(/Tools from<\/span>Hermes Agent/)
    }
  })

  it('names Rhizome as the harness and Free tier as it appears in the app', () => {
    expect(landing).toContain('<title>Rhizome</title>')
    expect(landing).toContain('Rhizome runs its own agent loop')
    expect(landing).toContain('Free tier (auto)')
    expect(landing).toContain('Graphite')
    expect(landing).toContain('Earth dark')
    expect(landing).toContain('The agent cannot search the vault yet')
    expect(readme).toContain('The agent cannot search the vault or old Mycelium sessions yet')
    expect(preview).toContain('System keychain')
  })
})
