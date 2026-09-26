import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTauri } from '../mock-tauri'
import {
  COMMAND_RAIL_TRAFFIC_LIGHT_INSET,
  MACOS_TRAFFIC_LIGHT_POSITION,
  MACOS_TRAFFIC_LIGHT_SAFE_PADDING,
  overlayTitleBarBandStyle,
  railConsumesExpandedWidth,
  reportedCommandRailLayoutWidth,
  sessionsColumnTitleBarStyle,
  subheadTrafficLightInset,
} from './trafficLights'

vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
}))

function configuredTrafficLightPosition(): { x: number; y: number } {
  const conf = JSON.parse(
    readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8'),
  ) as { app: { windows: Array<{ trafficLightPosition?: { x: number; y: number } }> } }
  const position = conf.app.windows[0]?.trafficLightPosition
  if (!position) throw new Error('main window has no trafficLightPosition')
  return position
}

describe('reported command rail layout width', () => {
  it('uses the open rail width, including hover, and 46 only when the rail is collapsed', () => {
    expect(reportedCommandRailLayoutWidth(true, 240)).toBe(240)
    expect(reportedCommandRailLayoutWidth(true, 46)).toBe(46)
    expect(reportedCommandRailLayoutWidth(false, 240)).toBe(0)
    expect(railConsumesExpandedWidth(240)).toBe(true)
    expect(railConsumesExpandedWidth(46)).toBe(false)
  })
})

describe('subheadTrafficLightInset', () => {
  it('keeps renderer geometry synchronized with the native config', () => {
    expect(MACOS_TRAFFIC_LIGHT_POSITION).toEqual(configuredTrafficLightPosition())
    expect(MACOS_TRAFFIC_LIGHT_POSITION.y).toBe(9)
    expect(COMMAND_RAIL_TRAFFIC_LIGHT_INSET).toBe(0)
    expect(MACOS_TRAFFIC_LIGHT_SAFE_PADDING).toBeGreaterThan(
      MACOS_TRAFFIC_LIGHT_POSITION.x + 52,
    )
  })

  const originalUserAgent = navigator.userAgent

  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false)
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    })
  })

  it('leaves Chat/Notes bands unpadded — MacOSTitlebar owns the lights', () => {
    expect(subheadTrafficLightInset()).toEqual({})
    vi.mocked(isTauri).mockReturnValue(true)
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',
    })
    expect(subheadTrafficLightInset()).toEqual({})
    expect(subheadTrafficLightInset(240)).toEqual({})
  })

  it('leaves the sessions column header unpadded under MacOSTitlebar', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',
    })

    expect(sessionsColumnTitleBarStyle()).toEqual({})
  })

  it('leaves the overlay title band unset — dedicated chrome holds the lights', () => {
    expect(overlayTitleBarBandStyle()).toEqual({})
    vi.mocked(isTauri).mockReturnValue(true)
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',
    })
    expect(overlayTitleBarBandStyle()).toEqual({})
  })
})
