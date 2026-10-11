import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAC_VIEW_SHORTCUT_POLICY,
  OTHER_VIEW_SHORTCUT_POLICY,
  matchRailViewShortcutEvent,
  railButtonAccessibleName,
  railViewShortcutAria,
  railViewShortcutDisplay,
  railViewShortcutDisplayForCommand,
  viewShortcutEventModifiers,
  viewShortcutPolicy,
} from './railViewShortcuts'

vi.mock('../utils/platform', () => ({
  isMac: vi.fn(() => false),
}))

import { isMac } from '../utils/platform'

const isMacMock = vi.mocked(isMac)

afterEach(() => {
  isMacMock.mockReturnValue(false)
})

describe('view shortcut policy', () => {
  it('uses Ctrl+Cmd on Mac', () => {
    expect(MAC_VIEW_SHORTCUT_POLICY).toMatchObject({
      combo: 'command-and-ctrl',
      displayPrefix: '⌃⌘',
      ariaPrefix: 'Control+Meta+',
    })
  })

  it('uses Ctrl+Shift on Windows and Linux, never Ctrl+Alt+digit', () => {
    expect(OTHER_VIEW_SHORTCUT_POLICY.combo).toBe('command-or-ctrl-shift')
    expect(OTHER_VIEW_SHORTCUT_POLICY.displayPrefix).not.toMatch(/Alt/)
    isMacMock.mockReturnValue(false)
    expect(viewShortcutPolicy()).toEqual(OTHER_VIEW_SHORTCUT_POLICY)
    expect(railViewShortcutDisplay(2)).toBe('Ctrl+Shift+2')
    expect(railViewShortcutAria(2)).toBe('Control+Shift+2')
    expect(railViewShortcutDisplayForCommand('go-mycelium')).toBe('Ctrl+Shift+3')
    expect(viewShortcutEventModifiers()).toEqual({
      altKey: false,
      shiftKey: true,
      ctrlKey: true,
      metaKey: false,
    })
  })

  it('reports Ctrl+Cmd when the platform is Mac', () => {
    isMacMock.mockReturnValue(true)
    expect(viewShortcutPolicy()).toEqual(MAC_VIEW_SHORTCUT_POLICY)
    expect(railViewShortcutDisplay(1)).toBe('⌃⌘1')
    expect(railViewShortcutAria(1)).toBe('Control+Meta+1')
    expect(viewShortcutEventModifiers()).toEqual({
      altKey: false,
      shiftKey: false,
      ctrlKey: true,
      metaKey: true,
    })
  })
})

describe('matchRailViewShortcutEvent', () => {
  it('opens Views with Ctrl+Shift+digit on non-Mac and ignores Ctrl+Alt+digit', () => {
    expect(matchRailViewShortcutEvent({
      altKey: false,
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      key: '3',
      code: 'Digit3',
    })).toBe('go-mycelium')
    expect(matchRailViewShortcutEvent({
      altKey: true,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      key: '2',
      code: 'Digit2',
    })).toBeNull()
  })

  it('opens Views with Ctrl+Cmd+digit on Mac and leaves Option+Cmd for BlockNote', () => {
    isMacMock.mockReturnValue(true)
    expect(matchRailViewShortcutEvent({
      altKey: false,
      ctrlKey: true,
      metaKey: true,
      shiftKey: false,
      key: '1',
      code: 'Digit1',
    })).toBe('go-research')
    expect(matchRailViewShortcutEvent({
      altKey: true,
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
      key: '1',
      code: 'Digit1',
    })).toBeNull()
  })
})

describe('railButtonAccessibleName', () => {
  it('puts the Changes count in the button name', () => {
    expect(railButtonAccessibleName('Changes', 4)).toBe('Changes, 4')
    expect(railButtonAccessibleName('Changes', 0)).toBe('Changes')
    expect(railButtonAccessibleName('Graph')).toBe('Graph')
  })
})
