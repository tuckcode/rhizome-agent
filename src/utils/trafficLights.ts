import { isTauri } from '../mock-tauri'
import { isMac } from './platform'

/**
 * Where macOS draws this app's window controls, from `tauri.conf.json`
 * (`trafficLightPosition`). The window uses an overlay title bar, so they are
 * painted *over* whatever renders at the top of the window.
 */
const TRAFFIC_LIGHT_LEFT_PX = 58

/** Three 12px lights with 8px gaps, plus breathing room before content. */
const TRAFFIC_LIGHT_RUN_PX = 70

/** The command rail the chat surface sits to the right of. */
const COMMAND_RAIL_WIDTH_PX = 46

/**
 * Left inset for the first band under the title bar, so the traffic lights do
 * not sit on top of its text.
 *
 * Only macOS needs it: Linux and Windows draw custom chrome, and the browser
 * preview has no window controls at all. Returned as a CSS variable so the
 * component keeps its padding in one class and simply gets a bigger value here.
 */
export function subheadTrafficLightInset(): Record<string, string> {
  if (!isTauri() || !isMac()) return {}
  const inset = TRAFFIC_LIGHT_LEFT_PX + TRAFFIC_LIGHT_RUN_PX - COMMAND_RAIL_WIDTH_PX
  return { '--subhead-traffic-light-inset': `${inset}px` }
}
