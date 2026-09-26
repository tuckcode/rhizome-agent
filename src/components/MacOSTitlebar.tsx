import { MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useDragRegion } from '../hooks/useDragRegion'
import {
  APP_COMMAND_EVENT_NAME,
  APP_COMMAND_IDS,
} from '../hooks/appCommandDispatcher'
import { getAppCommandShortcutDisplay } from '../hooks/appCommandCatalog'
import {
  hasNativeMacosTrafficLights,
  MACOS_TRAFFIC_LIGHT_SAFE_PADDING,
} from '../utils/trafficLights'

/**
 * Thin macOS chrome band. Traffic lights sit here (tao height = button + y),
 * and Command Palette docks on the left after them. The sessions rail starts
 * below this band so its border no longer cuts through the lights.
 */
export const MACOS_TITLEBAR_HEIGHT = 32

function openCommandPalette() {
  window.dispatchEvent(
    new CustomEvent(APP_COMMAND_EVENT_NAME, {
      detail: APP_COMMAND_IDS.viewCommandPalette,
    }),
  )
}

export function MacOSTitlebar() {
  const enabled = hasNativeMacosTrafficLights()
  const { dragRegionRef } = useDragRegion<HTMLDivElement>()

  if (!enabled) return null

  return (
    <div
      ref={dragRegionRef}
      className="fixed top-0 right-0 left-0 z-[1000] flex items-center border-b border-border bg-[var(--surface-sidebar)] select-none"
      style={{ height: MACOS_TITLEBAR_HEIGHT }}
      data-testid="macos-titlebar"
    >
      <div
        className="flex h-full items-center"
        style={{ paddingLeft: MACOS_TRAFFIC_LIGHT_SAFE_PADDING }}
        data-no-drag
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-[24px] gap-1.5 px-2 font-sans text-[12px] font-normal"
          onClick={openCommandPalette}
          aria-label="Command Palette"
          data-testid="open-command-palette"
          data-no-drag
        >
          <MagnifyingGlass size={14} />
          <span className="inline-flex items-center gap-1.5">
            Command Palette
            <kbd className="font-sans text-[11px] text-muted-foreground">
              {getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewCommandPalette)}
            </kbd>
          </span>
        </Button>
      </div>
    </div>
  )
}
