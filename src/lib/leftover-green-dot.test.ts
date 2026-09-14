import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiMessage.tsx`,
  'utf8',
)

describe('leftover green dot', () => {
  it('locks the latest assistant reply marker test id', () => {
    expect(source).toContain('data-testid="latest-assistant-reply-marker"')
  })
})
