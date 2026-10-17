import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover tokenjuice parked', () => {
  it('does not vendor TokenJuice or tinyhumans', () => {
    const pkg = readFileSync(`${process.cwd()}/package.json`, 'utf8')
    expect(pkg).not.toMatch(/tokenjuice|tinyhumans/i)
  })
})
