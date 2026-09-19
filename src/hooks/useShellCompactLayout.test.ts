import { describe, expect, it } from 'vitest'
import { getShellCompactState } from './useShellCompactLayout'

describe('compact shell budget', () => {
  it('folds Notes before the pinned rail', () => {
    expect(getShellCompactState(740, true)).toEqual({ collapseSessions: false, collapseVaultPanel: true })
    expect(getShellCompactState(639, true)).toEqual({ collapseSessions: true, collapseVaultPanel: true })
  })
  it('also protects Chat when no note is open', () => {
    expect(getShellCompactState(639, false)).toEqual({ collapseSessions: true, collapseVaultPanel: true })
  })
  it('does not invent a threshold before measurement', () => {
    expect(getShellCompactState(null, true)).toEqual({ collapseSessions: false, collapseVaultPanel: false })
  })
})
