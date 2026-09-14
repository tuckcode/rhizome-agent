import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover hide permission mode', () => {
  it('locks hidePermissionMode={isPrimeTarget} on the panel', () => {
    const panel = readFileSync(
      `${process.cwd()}/src/components/AiPanel.tsx`,
      'utf8',
    )
    expect(panel).toContain('hidePermissionMode={isPrimeTarget}')
  })

  it('locks hidePermissionMode branch in AiPanelChrome', () => {
    const chrome = readFileSync(
      `${process.cwd()}/src/components/AiPanelChrome.tsx`,
      'utf8',
    )
    expect(chrome).toContain('{hidePermissionMode ? (')
  })
})
