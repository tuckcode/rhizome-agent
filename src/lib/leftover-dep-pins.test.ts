import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/pnpm-workspace.yaml`, 'utf8')

describe('leftover dep pins', () => {
  it('locks js-yaml@3 at 3.15.2', () => {
    expect(source).toContain('js-yaml@3: 3.15.2')
  })

  it('locks fast-uri at 3.1.7', () => {
    expect(source).toContain('fast-uri: 3.1.7')
  })
})
