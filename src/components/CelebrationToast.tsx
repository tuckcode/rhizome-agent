import { X } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'

/**
 * The one line an agent sends with a celebration.
 *
 * Deliberately small and deliberately optional: confetti on its own is a
 * complete answer, and this only appears when the agent had something to say.
 * It sits above the cannon's canvas — which is `aria-hidden`, being pure
 * decoration — so this is the only part of a celebration a screen reader can
 * reach, hence `role="status"` rather than silence.
 */
export function CelebrationToast({
  message,
  from,
  onDismiss,
  locale = 'en',
}: {
  message: string
  from?: string
  onDismiss: () => void
  locale?: AppLocale
}) {
  const t = createTranslator(locale)

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="celebration-toast"
      // Below the title bar rather than in it: at the top of the window this
      // landed on the wordmark and the note-list header, and on macOS it would
      // share a band with the traffic lights.
      className="fixed inset-x-0 top-16 z-[10000] flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-panel,var(--card))] px-4 py-3 shadow-lg">
        <div className="min-w-0">
          <p className="text-sm leading-snug text-[var(--text-primary,var(--foreground))]">
            {message}
          </p>
          {from ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted,var(--muted-foreground))]">
              {t('ai.celebration.from', { name: from })}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label={t('ai.celebration.dismiss')}
          className="-mr-1 -mt-1 shrink-0"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  )
}
