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

function configuredTrafficLightPosition(): { x: number; y: number } {
  const conf = JSON.parse(
    readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8'),
  ) as { app: { windows: Array<{ trafficLightPosition?: { x: number; y: number } }> } }
  const position = conf.app.windows[0].trafficLightPosition
  if (!position) throw new Error('main window has no trafficLightPosition')
  return position
}

describe('CommandRail vs macOS traffic lights', () => {
  beforeEach(() => {
    localStorage.clear()
    platform.mac = true
  })

  // Lights sit in MacOSTitlebar (y≈9). The rail starts below that band via
  // body.mac-chrome padding, so its border never crosses the buttons.
  it('parks the traffic lights in the left corner of the title bar', () => {
    const { x, y } = configuredTrafficLightPosition()
    expect(x).toBeLessThan(RAIL_WIDTH)
    expect(x).toBeGreaterThanOrEqual(12)
    expect(y).toBe(9)
  })

  it('keeps the light run inside the expanded sessions band width', () => {
    expect(configuredTrafficLightPosition().x + TRAFFIC_LIGHT_SPAN).toBeLessThan(136)
  })

  it('does not pad the rail — MacOSTitlebar + body.mac-chrome clear the lights', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '0')

    const rail = renderRail()

    expect(rail.style.paddingTop).toBe('')
  })

  it('leaves the rail alone where the window has no traffic lights', () => {
    platform.mac = false

    const rail = renderRail()

    expect(rail.className).toContain('py-2')
    expect(rail.style.paddingTop).toBe('')
  })

  it('does not pad an expanded rail either — lights live above the shell', () => {
    localStorage.setItem(APP_STORAGE_KEYS.commandRailExpanded, '1')

    const rail = renderRail()

    expect(Number.parseInt(rail.style.width, 10)).toBe(RAIL_EXPANDED_WIDTH)
    expect(configuredTrafficLightPosition().x).toBeLessThan(RAIL_EXPANDED_WIDTH)
    expect(rail.style.paddingTop).toBe('')
  })
})
