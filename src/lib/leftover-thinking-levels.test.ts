import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/primeThinkingLevels.ts`,
  'utf8',
)

describe('leftover thinking levels', () => {
  it('locks Off / Low / Medium / High / X-High source labels', () => {
    expect(source).toContain("off: 'Off'")
    expect(source).toContain("low: 'Low'")
    expect(source).toContain("medium: 'Medium'")
    expect(source).toContain("high: 'High'")
    expect(source).toContain("xhigh: 'X-High'")
  })

  it('locks Minimal and Max because those keys already exist', () => {
    expect(source).toContain("minimal: 'Minimal'")
    expect(source).toContain("max: 'Max'")
  })
})
