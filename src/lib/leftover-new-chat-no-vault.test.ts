import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatHome.tsx`,
  'utf8',
)

describe('leftover new chat no vault', () => {
  it('locks onNewChat to newChatRef', () => {
    expect(source).toContain('onNewChat={() => newChatRef.current?.()}')
  })

  it('locks thinkingLevel from primeHost', () => {
    expect(source).toContain('thinkingLevel={primeHost?.thinkingLevel ?? null}')
  })
})
