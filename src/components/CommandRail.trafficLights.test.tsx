import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('../lib/productAnalytics', () => ({ trackRailDestinationClicked: vi.fn() }))
vi.mock('./ui/action-tooltip', () => ({
  ActionTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { CommandRail } from './CommandRail'

const RAIL_WIDTH = 46
/** macOS draws the three window buttons ~54px wide from the configured x. */
const TRAFFIC_LIGHT_SPAN = 54

function renderRail() {
  render(
    <CommandRail
      locale="en"
      activeDestination="notes"
      onSelectNotes={vi.fn()}
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

  it('no longer offsets the rail downward, since nothing overlaps it', () => {
    const rail = renderRail()

    // Symmetric padding via `py-2`; an asymmetric top inset would leave a
    // visible empty band at the rail's top for no reason.
    expect(rail.className).toContain('py-2')
    expect(rail.style.paddingTop).toBe('')
  })
})
