import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/hooks/useNoteLockMode.ts`,
  'utf8',
)

describe('leftover ephemeral note lock', () => {
  it('locks the C68 comment that note lock is not vault editor_mode', () => {
    expect(source).toContain('Not vault `editor_mode`')
  })
})
