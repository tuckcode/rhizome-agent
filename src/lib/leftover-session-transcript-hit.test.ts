import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')

describe('leftover session transcript hit open', () => {
  it('wires app search hits into the live chat at the message index', () => {
    expect(app).toContain('onSelectSessionHit=')
    expect(app).toContain('requestOpenSessionTranscriptHit')
    expect(app).toContain('handleRailSelectChat()')
  })
})
