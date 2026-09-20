import { useEffect, useRef } from 'react'
import { CirclesThree, GearSix, ShareNetwork, Sparkle } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { translate, type AppLocale, type TranslationKey } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'

export const NOTES_CHROME_EVENT = 'rhizome:notes-chrome'

export type NotesChromeDestination = 'research' | 'settings' | 'graph' | 'mycelium'
export type ConnectionsChromeView = Extract<NotesChromeDestination, 'graph' | 'mycelium'>

const SHORTCUT_BUTTON_CLASSNAME = '!h-[32px] !w-[32px] !min-w-[32px] !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent [&_svg]:!size-4'

const SHORTCUTS: ReadonlyArray<{
  destination: NotesChromeDestination
  icon: Icon
  labelKey: TranslationKey
}> = [
  { destination: 'research', icon: Sparkle, labelKey: 'status.research.open' },
  { destination: 'settings', icon: GearSix, labelKey: 'status.settings.open' },
  { destination: 'mycelium', icon: CirclesThree, labelKey: 'rail.mycelium' },
  { destination: 'graph', icon: ShareNetwork, labelKey: 'graph.title' },
]

let pendingConnectionsView: ConnectionsChromeView | null = null

export function consumePendingConnectionsView(): ConnectionsChromeView | null {
  const view = pendingConnectionsView
  pendingConnectionsView = null
  return view
}

export function resetNotesChromePendingForTests(): void {
  pendingConnectionsView = null
}

export function dispatchNotesChrome(destination: NotesChromeDestination): void {
  trackEvent('notes_chrome_shortcut', { destination })
  if (destination === 'settings') {
    window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
      detail: APP_COMMAND_IDS.appSettings,
    }))
    return
  }
  if (destination === 'graph' || destination === 'mycelium') {
    pendingConnectionsView = destination
  }
  if (destination === 'mycelium') {
    window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
      detail: APP_COMMAND_IDS.goChanges,
    }))
  }
  window.dispatchEvent(new CustomEvent(NOTES_CHROME_EVENT, { detail: destination }))
}

export function useNotesChromeStatusBridge({
  onOpenResearch,
  onClickGraph,
}: {
  onOpenResearch?: () => void
  onClickGraph?: () => void
}): void {
  const researchRef = useRef(onOpenResearch)
  const graphRef = useRef(onClickGraph)
  researchRef.current = onOpenResearch
  graphRef.current = onClickGraph

  useEffect(() => {
    const onChrome = (event: Event) => {
      const destination = (event as CustomEvent<NotesChromeDestination>).detail
      if (destination === 'research') researchRef.current?.()
      if (destination === 'graph') graphRef.current?.()
    }
    window.addEventListener(NOTES_CHROME_EVENT, onChrome)
    return () => window.removeEventListener(NOTES_CHROME_EVENT, onChrome)
  }, [])
}

export function NotesChromeShortcuts({ locale = 'en' }: { locale?: AppLocale }) {
  return (
    <div
      role="group"
      aria-label="Workspace shortcuts"
      data-testid="notes-chrome-shortcuts"
      className="ml-2 flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5"
    >
      {SHORTCUTS.map(({ destination, icon: Icon, labelKey }) => {
        const label = translate(locale, labelKey)
        return (
          <Button
            key={destination}
            type="button"
            variant="ghost"
            size="icon-xs"
            className={SHORTCUT_BUTTON_CLASSNAME}
            title={label}
            aria-label={label}
            data-no-drag
            onClick={() => dispatchNotesChrome(destination)}
          >
            <Icon size={16} weight="regular" />
          </Button>
        )
      })}
    </div>
  )
}
