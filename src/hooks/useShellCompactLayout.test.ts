import { describe, expect, it } from 'vitest'
import {
  getShellCompactState,
  SHELL_COLLAPSE_SESSIONS_WIDTH,
  SHELL_COLLAPSE_VAULT_PANEL_WIDTH,
} from './useShellCompactLayout'

describe('getShellCompactState', () => {
  it('does not collapse user panels until a note editor is open', () => {
    expect(getShellCompactState(700, false)).toEqual({
      collapseSessions: false,
      collapseVaultPanel: false,
    })
  })

  it('collapses Sessions before the vault panel as width decreases', () => {
    expect(getShellCompactState(SHELL_COLLAPSE_SESSIONS_WIDTH - 1, true)).toEqual({
      collapseSessions: true,
      collapseVaultPanel: false,
    })
    expect(getShellCompactState(SHELL_COLLAPSE_VAULT_PANEL_WIDTH - 1, true)).toEqual({
      collapseSessions: true,
      collapseVaultPanel: true,
    })
  })

  it('reserves more room when the editor inspector is open', () => {
    const width = SHELL_COLLAPSE_VAULT_PANEL_WIDTH + 100
    expect(getShellCompactState(width, true, false).collapseVaultPanel).toBe(false)
    expect(getShellCompactState(width, true, true).collapseVaultPanel).toBe(true)
  })
})
