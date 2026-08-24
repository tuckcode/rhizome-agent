import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTauri } from '../mock-tauri'
import { subheadTrafficLightInset } from './trafficLights'

vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
}))

const COMMAND_RAIL_WIDTH_PX = 46
/** Three Tahoe-sized buttons and the two gaps between them. */
const TRAFFIC_LIGHT_WIDTH_PX = 16 * 3 + 8 * 2
/** Space after the last light before status text may start. */
const TRAFFIC_LIGHT_CLEARANCE_PX = 16

function configuredTrafficLightX(): number {
  const conf = JSON.parse(
    readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8'),
  ) as { app: { windows: Array<{ trafficLightPosition?: { x: number } }> } }
  const position = conf.app.windows[0]?.trafficLightPosition
  if (!position) throw new Error('main window has no trafficLightPosition')
  return position.x
}

describe('subheadTrafficLightInset', () => {
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

  it('leaves the browser and non-Mac chrome unpadded', () => {
    expect(subheadTrafficLightInset()).toEqual({})
  })

  it('starts Chat status text after the traffic lights, not under them', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15',
    })

    const inset = Number.parseInt(
      subheadTrafficLightInset()['--subhead-traffic-light-inset'] ?? '',
      10,
    )
    const contentStart = COMMAND_RAIL_WIDTH_PX + inset
    const lightsEnd =
      configuredTrafficLightX() + TRAFFIC_LIGHT_WIDTH_PX + TRAFFIC_LIGHT_CLEARANCE_PX

    expect(contentStart).toBeGreaterThanOrEqual(lightsEnd)
  })
})
