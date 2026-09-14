import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiPanel.tsx`,
  'utf8',
)

describe('leftover steer wiring', () => {
  it('locks Prime-only onSteer on AiPanel', () => {
    expect(source).toContain(
      'onSteer={isPrimeTarget ? handleSteer : undefined}',
    )
  })
})
