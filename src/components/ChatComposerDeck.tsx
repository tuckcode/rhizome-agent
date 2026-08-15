import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { PrimeModelPicker } from './PrimeModelPicker'

interface ChatComposerDeckProps {
  locale?: AppLocale
  modelLabel?: string | null
  vaultLabel?: string | null
  skillsLabel?: string | null
  vaultPath?: string
  /** Frame B — the note open in the secondary pane. */
  contextLabel?: string | null
  /** True while a turn is running — the model cannot change mid-turn. */
  working?: boolean
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
        accent ? 'border-primary/40 text-foreground' : 'border-border',
      )}
    >
      {children}
    </span>
  )
}

/**
 * Frame A's composer control deck.
 *
 * Says what this message is about to be sent to — agent, model, vault, skills
 * — at the point of sending, rather than in a settings screen the user is not
 * looking at. In a chat-first window this row is the only standing answer to
 * "what am I talking to right now".
 */
export function ChatComposerDeck({
  locale = 'en',
  modelLabel,
  vaultLabel,
  skillsLabel,
  vaultPath,
  contextLabel,
  working = false,
}: ChatComposerDeckProps) {
  const t = createTranslator(locale)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="chat-composer-deck">
      <Chip accent>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        {t('ai.panel.title')}
      </Chip>

      <PrimeModelPicker
        locale={locale}
        label={modelLabel}
        disabled={working}
        vaultPath={vaultPath}
      />

      {vaultLabel ? <Chip title={t('ai.composer.vault')}>{vaultLabel}</Chip> : null}
      {contextLabel ? <Chip>{t('ai.composer.context', { note: contextLabel })}</Chip> : null}
      {skillsLabel ? (
        <Chip>{t('ai.panel.skills.withVault', { skills: skillsLabel })}</Chip>
      ) : null}
    </div>
  )
}
