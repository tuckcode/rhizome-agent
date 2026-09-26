import { Article, ArrowsClockwise as RefreshCw, Cube, GitBranch, Info, ListChecks, Palette, PuzzlePiece, Robot as Bot, ShieldCheck, type IconProps } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import type { TranslationKey } from '../lib/i18n'
import { Button } from './ui/button'
import { SETTINGS_SECTION_IDS } from './settingsSectionIds'

interface SettingsBodyNavProps {
  t: (key: TranslationKey) => string
  onVisit?: (id: string) => void
}

interface SettingsNavItem {
  id: string
  label: string
  Icon: ComponentType<IconProps>
}

const FOLLOW_MS = 2000
const STOP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
let stopFollowing: (() => void) | null = null

/**
 * Scroll a section's heading to the top and keep it there while content
 * settles. Packages loads its catalog lazily as the scroll passes it, which
 * pushed later sections (About) down mid-scroll (browser preview,
 * 2026-09-26). Stops on the user's own scroll or input, or after 2s.
 */
function scrollSectionToTop(section: HTMLElement) {
  stopFollowing?.()
  section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  const container = section.closest('.overflow-auto')
  if (!(container instanceof HTMLElement) || typeof ResizeObserver === 'undefined') return

  const observer = new ResizeObserver(() => section.scrollIntoView({ block: 'start' }))
  for (const child of Array.from(container.children)) observer.observe(child)
  const timer = window.setTimeout(() => stop(), FOLLOW_MS)
  const stop = () => {
    observer.disconnect()
    window.clearTimeout(timer)
    for (const type of STOP_EVENTS) container.removeEventListener(type, stop)
    if (stopFollowing === stop) stopFollowing = null
  }
  for (const type of STOP_EVENTS) container.addEventListener(type, stop, { passive: true })
  stopFollowing = stop
}

export function SettingsBodyNav({ t, onVisit }: SettingsBodyNavProps) {
  const items: SettingsNavItem[] = [
    { id: SETTINGS_SECTION_IDS.sync, label: t('settings.sync.title'), Icon: RefreshCw },
    { id: SETTINGS_SECTION_IDS.workspaces, label: t('settings.workspaces.title'), Icon: Cube },
    { id: SETTINGS_SECTION_IDS.autogit, label: t('settings.autogit.title'), Icon: GitBranch },
    { id: SETTINGS_SECTION_IDS.appearance, label: t('settings.appearance.title'), Icon: Palette },
    { id: SETTINGS_SECTION_IDS.content, label: t('settings.vaultContent.title'), Icon: Article },
    { id: SETTINGS_SECTION_IDS.ai, label: t('settings.aiAgents.title'), Icon: Bot },
    { id: SETTINGS_SECTION_IDS.extensions, label: 'Packages', Icon: PuzzlePiece },
    { id: SETTINGS_SECTION_IDS.workflow, label: t('settings.workflow.title'), Icon: ListChecks },
    { id: SETTINGS_SECTION_IDS.privacy, label: t('settings.privacy.title'), Icon: ShieldCheck },
    { id: SETTINGS_SECTION_IDS.about, label: t('settings.about.title'), Icon: Info },
  ]

  return (
    <div className="hidden w-64 shrink-0 border-r border-border px-3 py-4 md:block">
      <div className="sticky top-0 space-y-1.5">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-full justify-start gap-2.5 px-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            data-testid={`settings-nav-${item.id}`}
            onClick={() => {
              onVisit?.(item.id)
              const section = document.getElementById(item.id)
              if (section) scrollSectionToTop(section)
            }}
          >
            <item.Icon size={16} weight="regular" className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
