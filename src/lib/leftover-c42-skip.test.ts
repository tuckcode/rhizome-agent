import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover C42 skip', () => {
  it('locks still no Windows work this window. C42 stays skip.', () => {
    const windowsDev = readFileSync(`${process.cwd()}/docs/WINDOWS-DEV.md`, 'utf8')
    expect(windowsDev).toContain('still no Windows work this window. C42 stays skip.')
  })
})
