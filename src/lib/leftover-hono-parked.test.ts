import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/pnpm-workspace.yaml`, 'utf8')

describe('leftover hono parked', () => {
  it('locks hono at 4.13.5', () => {
    expect(source).toContain('hono: 4.13.5')
  })

  it('locks qs at 6.16.0', () => {
    expect(source).toContain('qs: 6.16.0')
  })
})
