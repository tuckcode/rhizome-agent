import { isTauri } from '../mock-tauri'
import { isMac } from './platform'

/**
 * Where macOS draws this app's window controls, from `tauri.conf.json`
 * (`trafficLightPosition`). The window uses an overlay title bar, so they are
 * painted *over* whatever renders at the top of the window.
 */
export const MACOS_TRAFFIC_LIGHT_POSITION = {
  x: 58,
  y: 16,
} as const

/** Three 12px lights with 8px gaps, plus breathing room before content. */
const TRAFFIC_LIGHT_RUN_PX = 70
/** Extra gap after the last light. 70px ends flush with the status text. */
const TRAFFIC_LIGHT_CLEARANCE_PX = 16

/** Collapsed command rail and matching Notes restore rail. */
export const COMMAND_RAIL_WIDTH_PX = 46
/** Expanded Sessions rail and matching open Notes column. */
export const COMMAND_RAIL_EXPANDED_WIDTH_PX = 240

export const MACOS_TRAFFIC_LIGHT_SAFE_PADDING =
  MACOS_TRAFFIC_LIGHT_POSITION.x +
  TRAFFIC_LIGHT_RUN_PX +
  TRAFFIC_LIGHT_CLEARANCE_PX

export const COMMAND_RAIL_TRAFFIC_LIGHT_INSET =
  MACOS_TRAFFIC_LIGHT_POSITION.y + 43

export function hasNativeMacosTrafficLights(): boolean {
  return isTauri() && isMac()
}

/**
 * Left inset for the first band under the title bar, so the traffic lights do
 * not sit on top of its text.
 *
 * Only macOS needs it: Linux and Windows draw custom chrome, and the browser
 * preview has no window controls at all. Returned as a CSS variable so the
 * component keeps its padding in one class and simply gets a bigger value here.
 */
export function subheadTrafficLightInset(): Record<string, string> {
  if (!hasNativeMacosTrafficLights()) return {}
  const inset =
    MACOS_TRAFFIC_LIGHT_SAFE_PADDING -
    COMMAND_RAIL_WIDTH_PX
  return { '--subhead-traffic-light-inset': `${inset}px` }
}

/**
 * When the sessions column is the topmost band — no Prime subhead above it —
 * its header must clear the overlay traffic lights vertically and horizontally.
 * Same horizontal math as the subhead; vertical matches the command rail.
 */
export function sessionsColumnTitleBarStyle(): Record<string, string | number> {
  if (!hasNativeMacosTrafficLights()) return {}
  return {
    ...subheadTrafficLightInset(),
    paddingTop: COMMAND_RAIL_TRAFFIC_LIGHT_INSET,
    minHeight: COMMAND_RAIL_TRAFFIC_LIGHT_INSET + 40,
  }
}
