import { createTranslator, type AppLocale } from '../lib/i18n'
import { cn } from '@/lib/utils'

interface ChatComposerFootProps {
  locale?: AppLocale
  working?: boolean
  lastToolName?: string | null
}

/**
 * Turn status inside ChatComposerBar. Rendered only while a turn runs —
 * idle is the normal state and says nothing (native audit 2026-09-26).
 * Key hints live on the Send button's tooltip. There is no stop hint:
 * Escape leaves Chat (useAiPanelFocus), and Stop is click-only.
 */
export function ChatComposerFoot({
  locale = 'en',
  working = false,
  lastToolName = null,
}: ChatComposerFootProps) {
  const t = createTranslator(locale)
  const status = working
    ? (lastToolName
        ? t('ai.composer.foot.working', { tool: lastToolName })
        : t('ai.composer.foot.workingBare'))
    : t('ai.composer.foot.idle')

  return (
    <span
      data-testid="chat-composer-foot"
      role="status"
      className={cn(
        'min-w-0 truncate font-mono text-[12px] tracking-[0.03em] text-muted-foreground',
        working && 'text-primary',
      )}
    >
      {status}
    </span>
  )
}
