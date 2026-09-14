import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/pnpm-workspace.yaml`, 'utf8')

describe('leftover hono parked', () => {
  it('locks hono at 4.12.34', () => {
    expect(source).toContain('hono: 4.12.34')
  })

  it('locks qs at 6.15.2', () => {
    expect(source).toContain('qs: 6.15.2')
  })
})
