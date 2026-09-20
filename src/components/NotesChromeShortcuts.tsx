import { CirclesThree, GearSix, ShareNetwork, Sparkle } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { dispatchNotesChrome } from '../lib/notesChrome'
import { translate, type AppLocale, type TranslationKey } from '../lib/i18n'

const SHORTCUT_BUTTON_CLASSNAME = '!h-[32px] !w-[32px] !min-w-[32px] !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent [&_svg]:!size-4'

const SHORTCUTS: ReadonlyArray<{
  destination: 'research' | 'settings' | 'graph' | 'mycelium'
  icon: Icon
  labelKey: TranslationKey
}> = [
  { destination: 'research', icon: Sparkle, labelKey: 'status.research.open' },
  { destination: 'settings', icon: GearSix, labelKey: 'status.settings.open' },
  { destination: 'mycelium', icon: CirclesThree, labelKey: 'rail.mycelium' },
  { destination: 'graph', icon: ShareNetwork, labelKey: 'graph.title' },
]

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
