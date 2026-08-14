import { createTranslator, type AppLocale } from '../lib/i18n'
import { cn } from '@/lib/utils'

interface ChatComposerFootProps {
  locale?: AppLocale
  working?: boolean
  lastToolName?: string | null
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-sm border border-border bg-background px-1 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  )
}

/**
 * Frame A composer foot: last-tool status on the left, key hints on the right.
 *
 * Lives under the composer box, not in ChatComposerDeck — the last tool name
 * comes from the panel controller, which the deck never sees.
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
    <div
      data-testid="chat-composer-foot"
      className={cn(
        'mt-[7px] flex items-center justify-between font-mono text-[10px] tracking-[0.03em] text-muted-foreground',
        working && 'text-primary',
      )}
    >
      <span>{status}</span>
      <span className="inline-flex items-center gap-1">
        {working ? (
          <>
            <Kbd>Esc</Kbd> {t('ai.composer.foot.stop')} · <Kbd>⌘</Kbd><Kbd>.</Kbd>
          </>
        ) : (
          <>
            <Kbd>⌘</Kbd><Kbd>↵</Kbd> {t('ai.composer.foot.send')}
          </>
        )}
      </span>
    </div>
  )
}
