import { describe, expect, it } from 'vitest'
import { compactDiffLines } from './approvalDiff'

describe('compactDiffLines', () => {
  it('drops only the leading file-header pair', () => {
    const lines = compactDiffLines(
      '--- notes/plan.md\n+++ notes/plan.md\n@@ -1,1 +1,1 @@\n-draft\n+ready\n',
    )
    expect(lines).toEqual(['@@ -1,1 +1,1 @@', '-draft', '+ready'])
  })

  it('keeps content lines that start with --- or +++', () => {
    const lines = compactDiffLines(
      [
        '--- a.md',
        '+++ a.md',
        '@@ -1,3 +1,3 @@',
        '+---',
        '++evil;',
        '-- sql',
      ].join('\n'),
    )
    expect(lines).toEqual(['@@ -1,3 +1,3 @@', '+---', '++evil;', '-- sql'])
    expect(lines.some((line) => line === '+---')).toBe(true)
    expect(lines.some((line) => line === '++evil;')).toBe(true)
    expect(lines.some((line) => line === '-- sql')).toBe(true)
  })
})
