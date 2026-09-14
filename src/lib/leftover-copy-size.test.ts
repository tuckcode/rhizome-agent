import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiMessage.tsx`,
  'utf8',
)

describe('leftover copy size', () => {
  it('locks the 14px copy action icon', () => {
    expect(source).toContain('<Copy size={14} aria-hidden="true" />')
  })
})
