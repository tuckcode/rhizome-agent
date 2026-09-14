import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1630-last-idle-native-findings.md`,
  'utf8',
)

describe('leftover last idle not run', () => {
  it('locks the native last-conversation relaunch not-run finding', () => {
    expect(source).toContain('Native last-conversation relaunch — NOT RUN')
  })
})
