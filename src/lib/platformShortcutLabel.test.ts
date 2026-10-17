import { afterEach, describe, expect, it } from 'vitest'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../hooks/appCommandCatalog'
import { railViewShortcutDisplay } from './railViewShortcuts'
import { platformShortcutLabel } from './platformShortcutLabel'

const originalUserAgent = navigator.userAgent
const originalPlatform = navigator.platform

function setNavigator(userAgent: string, platform = originalPlatform) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: platform,
  })
}

describe('platformShortcutLabel', () => {
  afterEach(() => {
    setNavigator(originalUserAgent, originalPlatform)
  })

  it('returns the Mac label on a Macintosh user agent', () => {
    setNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    expect(platformShortcutLabel('⌘K', 'Ctrl+K')).toBe('⌘K')
    expect(getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewCommandPalette)).toBe('⌘K')
    expect(getAppCommandShortcutDisplay(APP_COMMAND_IDS.appSettings)).toBe('⌘,')
    expect(railViewShortcutDisplay(1)).toBe('⌃⌘1')
    expect(railViewShortcutDisplay(4)).toBe('⌃⌘4')
  })

  it('returns the other label on Windows and Linux', () => {
    setNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    expect(platformShortcutLabel('⌘K', 'Ctrl+K')).toBe('Ctrl+K')
    expect(getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewCommandPalette)).toBe('Ctrl+K')
    expect(getAppCommandShortcutDisplay(APP_COMMAND_IDS.appSettings)).toBe('Ctrl+,')
    expect([1, 2, 3, 4].map((n) => railViewShortcutDisplay(n as 1 | 2 | 3 | 4))).toEqual([
      'Ctrl+Shift+1',
      'Ctrl+Shift+2',
      'Ctrl+Shift+3',
      'Ctrl+Shift+4',
    ])
  })

  it('treats a generic user agent with a Mac platform as Mac', () => {
    setNavigator('Mozilla/5.0', 'MacIntel')
    expect(platformShortcutLabel('⌘,', 'Ctrl+,')).toBe('⌘,')
    expect(getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewCommandPalette)).toBe('⌘K')
    expect(railViewShortcutDisplay(2)).toBe('⌃⌘2')
  })
})
