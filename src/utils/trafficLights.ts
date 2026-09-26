import { isTauri } from '../mock-tauri'
import { isMac } from './platform'

/**
 * Where macOS draws this app's window controls, from `tauri.conf.json`
 * (`trafficLightPosition`). The window uses an overlay title bar, so they are
 * painted *over* the dedicated `MacOSTitlebar` band. tao sizes that band as
 * button height + y, so y≈9 seats the lights in a 32px chrome strip.
 */
export const MACOS_TRAFFIC_LIGHT_POSITION = {
  x: 14,
  y: 9,
} as const

/** Three 12px lights with 8px gaps, plus breathing room before content. */
const TRAFFIC_LIGHT_RUN_PX = 70
/** Extra gap after the last light before the docked Command Palette. */
const TRAFFIC_LIGHT_CLEARANCE_PX = 32

/** Collapsed command rail and matching Notes restore rail. */
export const COMMAND_RAIL_WIDTH_PX = 46
/** Expanded Sessions rail and matching open Notes column. */
export const COMMAND_RAIL_EXPANDED_WIDTH_PX = 240

export const MACOS_TRAFFIC_LIGHT_SAFE_PADDING =
  MACOS_TRAFFIC_LIGHT_POSITION.x +
  TRAFFIC_LIGHT_RUN_PX +
  TRAFFIC_LIGHT_CLEARANCE_PX

/**
 * Vertical room the sessions rail used to reserve under overlay lights.
 * With `MacOSTitlebar` + `body.mac-chrome` padding, content starts below the
 * lights, so the rail no longer pads itself.
 */
export const COMMAND_RAIL_TRAFFIC_LIGHT_INSET = 0

export function hasNativeMacosTrafficLights(): boolean {
  return isTauri() && isMac()
}

/** Width the shell reserves for the sessions rail. Disabled means no rail. */
export function reportedCommandRailLayoutWidth(enabled: boolean, reportedWidth: number): number {
  if (!enabled) return 0
  if (!Number.isFinite(reportedWidth) || reportedWidth <= 0) return COMMAND_RAIL_WIDTH_PX
  return reportedWidth
}

/** True when the rail is open wide enough that Chat and the title line must move. */
export function railConsumesExpandedWidth(reportedWidth: number): boolean {
  return reportedWidth > COMMAND_RAIL_WIDTH_PX
}

/**
 * Left inset for Chat's status line when overlay lights shared that band.
 * `MacOSTitlebar` now owns the lights above content, so this is empty.
 */
export function subheadTrafficLightInset(railLayoutWidth = COMMAND_RAIL_WIDTH_PX): Record<string, string> {
  void railLayoutWidth
  return {}
}

/**
 * Shared Chat/Notes/rail paint under overlay lights. Empty once the dedicated
 * macOS title bar holds those lights above the shell.
 */
export function overlayTitleBarBandStyle(railLayoutWidth = COMMAND_RAIL_WIDTH_PX): Record<string, string | number> {
  void railLayoutWidth
  return {}
}

/**
 * When the sessions column is the topmost band — no Prime subhead above it —
 * its header used to clear overlay traffic lights. Empty with `MacOSTitlebar`.
 */
export function sessionsColumnTitleBarStyle(): Record<string, string | number> {
  return {}
}
