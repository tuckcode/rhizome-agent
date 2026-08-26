import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('../lib/productAnalytics', () => ({ trackRailDestinationClicked: vi.fn() }))
vi.mock('../mock-tauri', () => ({ isTauri: () => true }))
const platform = vi.hoisted(() => ({ mac: true }))
vi.mock('../utils/platform', () => ({ isMac: () => platform.mac }))
vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { CommandRail } from './CommandRail'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

const RAIL_WIDTH = 46
const RAIL_EXPANDED_WIDTH = 168
/** macOS draws the three window buttons ~54px wide from the configured x. */
const TRAFFIC_LIGHT_SPAN = 54

function renderRail() {
  render(
    <CommandRail
      locale="en"
      activeDestination="inbox"
      onSelectInbox={vi.fn()}
      onSelectGraph={vi.fn()}
      onSelectMycelium={vi.fn()}
      onOpenResearch={vi.fn()}
      onSelectChanges={vi.fn()}
      onOpenSettings={vi.fn()}
    />
  )
  return screen.getByTestId('command-rail')
}

function configuredTrafficLightX(): number {
  const conf = JSON.parse(
    readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8'),
  ) as { app: { windows: Array<{ trafficLightPosition?: { x: number; y: number } }> } }
  const position = conf.app.windows[0].trafficLightPosition
  if (!position) throw new Error('main window has no trafficLightPosition')
  return position.x
}

describe('CommandRail vs macOS traffic lights', () => {
  beforeEach(() => {
    localStorage.clear()
    platform.mac = true
  })

  // The window uses titleBarStyle "Overlay", so the system buttons float over
  // the webview. They were configured at x=18 and overlapped this 46px rail —
  // first vertically (worked around by pushing the rail's content down), then
  // still horizontally, straddling the rail/sidebar divider. Moving the lights
  // clear of the rail solves both, so the vertical workaround is gone.
  it('positions the traffic lights fully clear of the rail', () => {
    expect(configuredTrafficLightX()).toBeGreaterThanOrEqual(RAIL_WIDTH)
  })

  it('leaves the lights room beside the rail without reaching sidebar controls', () => {
    // They land in the sidebar's top band; the sidebar's own leftmost control
    // sits at roughly x136, so the lights must finish well before that.
    expect(configuredTrafficLightX() + TRAFFIC_LIGHT_SPAN).toBeLessThan(136)
  })

  /**
   * A collapsed rail clears the lights horizontally — x=58 is past its 46px —
   * but that only means they are *beside* the first destination rather than on
   * it, close enough that the audit read them as belonging to it. Content
   * starts below the lights in both states now, as it does in every macOS
   * sidebar.
   */
  it('offsets a collapsed rail too, so nothing sits level with the lights', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '0')

    const rail = renderRail()

    expect(Number.parseInt(rail.style.paddingTop, 10)).toBeGreaterThanOrEqual(40)
  })

  /**
   * Off-Mac there are no lights to make room for, and the inset would be a
   * dent in the top of the rail with nothing in it.
   */
  it('leaves the rail alone where the window has no traffic lights', () => {
    platform.mac = false

    const rail = renderRail()

    expect(rail.className).toContain('py-2')
    expect(rail.style.paddingTop).toBe('')
  })

  /**
   * Expanding the rail (2026-08-20, to label the destinations) put it back
   * under the lights: 168px of rail against lights that start at x=58. The
   * horizontal escape the config bought only holds while the rail is narrow,
   * so the wide state makes room vertically instead — which is what every
   * macOS sidebar does with the lights sitting in its top band.
   */
  it('offsets an expanded rail, which reaches under the lights', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '1')

    const rail = renderRail()

    expect(Number.parseInt(rail.style.width, 10)).toBe(RAIL_EXPANDED_WIDTH)
    expect(configuredTrafficLightX()).toBeLessThan(RAIL_EXPANDED_WIDTH)

    const inset = Number.parseInt(rail.style.paddingTop, 10)
    // Clear of the lights themselves: they are drawn ~16px tall from y=24.
    expect(inset).toBeGreaterThanOrEqual(40)
  })
})
