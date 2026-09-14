import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/AGENTS.md`, 'utf8')

describe('leftover Kern Linux/WSL2 only', () => {
  it('locks the ADR-0168 note that Kern is Linux/WSL2 only', () => {
    expect(source).toContain('Kern (getkern/kern) is Linux/WSL2 only.')
  })
})
