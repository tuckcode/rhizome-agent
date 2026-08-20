import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'

interface ChatComposerDeckProps {
  locale?: AppLocale
  vaultLabel?: string | null
  skillsLabel?: string | null
  /** Frame B — the note open in the secondary pane. */
  contextLabel?: string | null
}

function Chip({
  children,
  accent = false,
  title,
}: {
  children: ReactNode
  accent?: boolean
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5',
        'font-mono text-[10.5px] text-muted-foreground',
        accent ? 'border-[var(--accent-green)]/40 text-foreground' : 'border-border',
      )}
    >
      {children}
    </span>
  )
}

/**
 * Frame A's composer control deck.
 *
 * Says what this message is about to be sent to — agent, vault, skills — at
 * the point of sending, rather than in a settings screen the user is not
 * looking at.
 *
 * The model is deliberately absent: #9 moved it to the telemetry strip, where
 * it sits with the thinking level as a single control. Two places to read the
 * model meant two places that could disagree about which one answered.
 */
export function ChatComposerDeck({
  locale = 'en',
  vaultLabel,
  skillsLabel,
  contextLabel,
}: ChatComposerDeckProps) {
  const t = createTranslator(locale)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="chat-composer-deck">
      <Chip accent>
        {/* Status, not brand — see PrimeSessionSubhead. */}
        <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent-green)]" />
        {t('ai.panel.title')}
      </Chip>

      {/* The model picker moved to the telemetry strip and is deliberately
          NOT duplicated here (#9): one place to read the model, one place to
          change it, and they are the same place. The deck keeps vault and
          skills. */}

      {vaultLabel ? <Chip title={t('ai.composer.vault')}>{vaultLabel}</Chip> : null}
      {contextLabel ? <Chip>{t('ai.composer.context', { note: contextLabel })}</Chip> : null}
      {skillsLabel ? (
        <Chip>{t('ai.panel.skills.withVault', { skills: skillsLabel })}</Chip>
      ) : null}
    </div>
  )
}
