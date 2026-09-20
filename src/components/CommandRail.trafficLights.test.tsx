import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('../lib/productAnalytics', () => ({
  trackCommandRailPinChanged: vi.fn(),
}))
vi.mock('../mock-tauri', () => ({ isTauri: () => true }))
const platform = vi.hoisted(() => ({ mac: true }))
vi.mock('../utils/platform', () => ({ isMac: () => platform.mac }))
vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { CommandRail } from './CommandRail'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

const RAIL_WIDTH = 46
const RAIL_EXPANDED_WIDTH = 240
/** macOS draws the three window buttons ~54px wide from the configured x. */
const TRAFFIC_LIGHT_SPAN = 54

function renderRail() {
  render(
    <CommandRail
      locale="en"
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
  // the webview. They live in the left corner (x=14) like every macOS app —
  // under the rail — and the rail clears them vertically. Do not park them
  // mid-sidebar to dodge the rail horizontally; that looked wrong (Atticus
  // 2026-09-17).
  it('parks the traffic lights in the left corner under the rail', () => {
    expect(configuredTrafficLightX()).toBeLessThan(RAIL_WIDTH)
    expect(configuredTrafficLightX()).toBeGreaterThanOrEqual(12)
  })

  it('keeps the light run inside the expanded sessions band', () => {
    // Collapsed rail is only 46px; lights spill past it into the next column.
    // Expanded 240px rail owns the top band — lights must finish well before
    // the first labeled control (~x136).
    expect(configuredTrafficLightX() + TRAFFIC_LIGHT_SPAN).toBeLessThan(136)
  })

  /**
   * Left-corner lights sit on the collapsed rail; content starts below them
   * so nothing shares a row with the buttons.
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
   * Expanded rail (240px) always runs under left-corner lights. Vertical
   * inset is the macOS pattern — same as Finder's sidebar.
   */
  it('offsets an expanded rail, which reaches under the lights', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '1')

    const rail = renderRail()

    expect(Number.parseInt(rail.style.width, 10)).toBe(RAIL_EXPANDED_WIDTH)
    expect(configuredTrafficLightX()).toBeLessThan(RAIL_EXPANDED_WIDTH)

    const inset = Number.parseInt(rail.style.paddingTop, 10)
    // Clear of the lights themselves: they are drawn ~16px tall from y=16.
    expect(inset).toBeGreaterThanOrEqual(40)
  })
})
