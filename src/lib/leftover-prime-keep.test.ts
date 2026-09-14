import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Prime keep chrome', () => {
  it('locks ChatHome so a global API default cannot strip Prime chrome', () => {
    const chatHome = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    expect(chatHome).toContain(
      'global default must not strip Prime chrome or route chat away from Prime',
    )
    expect(chatHome).toContain("if (defaultAiTarget?.kind === 'api_model')")
    expect(chatHome).toContain("target.agent === 'prime'")
  })
})
