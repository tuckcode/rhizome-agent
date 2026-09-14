import type { ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackComposerPillOpened } from '../lib/productAnalytics'
import { PrimeModelPicker } from './PrimeModelPicker'
import { PrimeThinkingToggle } from './PrimeThinkingToggle'

interface ChatComposerDeckProps {
  locale?: AppLocale
  skillsLabel?: string | null
  /** Frame B — the note open in the secondary pane. */
  contextLabel?: string | null
  /** Stop sending the open note. Without it the pill stays a plain label. */
  onCloseContext?: () => void
  model?: string | null
  thinkingLevel?: string | null
  vaultPath?: string
  /** True when Chat already has a live Prime host. */
  hostReady?: boolean
  /** Agent activity — idle/working pill, sits next to thinking. */
  activity?: ReactNode
}

function pillClass(accent = false) {
  return cn(
    'inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5',
    'font-mono text-[11px] transition-colors',
    'border-[var(--border-default,var(--border))]',
    'hover:bg-[var(--state-hover,var(--accent))] hover:text-foreground',
    accent ? 'border-[var(--accent-green)]/40 text-foreground' : 'text-muted-foreground',
  )
}

function Chip({
  children,
  title,
  testId,
  className,
}: {
  children: ReactNode
  title?: string
  testId?: string
  className?: string
}) {
  return (
    <span
      title={title}
      data-testid={testId}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5',
        'font-mono text-[11px] text-muted-foreground border-border',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Frame A's composer control strip (#38 / #9 / #35).
 *
 * Model and thinking are live turn controls. Prime and the skill name are
 * labels — menus that cannot change either were lying. Agent idle/working
 * sits next to thinking. The vault switcher lives only in the status bar.
 */
export function ChatComposerDeck({
  locale = 'en',
  skillsLabel,
  contextLabel,
  onCloseContext,
  model,
  thinkingLevel,
  vaultPath,
  hostReady = false,
  activity,
}: ChatComposerDeckProps) {
  const t = createTranslator(locale)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="chat-composer-deck">
      <Chip title={t('ai.composer.agent')} testId="composer-agent-pill">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent-green)]" />
        {t('ai.panel.title')}
      </Chip>

      <span
        onPointerDown={() => trackComposerPillOpened('model')}
      >
        <PrimeModelPicker
          locale={locale}
          label={model}
          thinkingLevel={thinkingLevel}
          side="top"
          variant="chip"
          vaultPath={vaultPath}
          hostReady={hostReady}
        />
      </span>

      <PrimeThinkingToggle
        locale={locale}
        thinkingLevel={thinkingLevel}
        vaultPath={vaultPath}
      />

      {activity}

      {/* #38: a pill that looks like a control has to be one. With no way to
          act on the context there is nothing to open, so it stays a plain
          label rather than a dropdown that shrugs. */}
      {contextLabel && onCloseContext ? (
        <DropdownMenu onOpenChange={(open) => { if (open) trackComposerPillOpened('context') }}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={pillClass()}
              aria-label={t('ai.composer.context', { note: contextLabel })}
              data-testid="composer-context-pill"
              title={t('ai.composer.context', { note: contextLabel })}
            >
              <span className="min-w-0 truncate">
                {t('ai.composer.context', { note: contextLabel })}
              </span>
              <CaretDown size={9} weight="bold" className="shrink-0 text-[var(--text-faint,var(--muted-foreground))]" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {t('ai.composer.contextTitle')}
            </DropdownMenuLabel>
            {/* Says what the pill means. "ctx · note" is shorthand nobody is
                born knowing, and this row is the only place to explain it. */}
            <DropdownMenuItem disabled className="text-[12px] text-muted-foreground">
              {t('ai.composer.contextExplain')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12px]"
              data-testid="composer-context-clear"
              onSelect={() => onCloseContext()}
            >
              {t('ai.composer.contextClear')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : contextLabel ? (
        <Chip
          className="min-w-0 max-w-full shrink"
          title={t('ai.composer.context', { note: contextLabel })}
        >
          <span className="min-w-0 truncate">
            {t('ai.composer.context', { note: contextLabel })}
          </span>
        </Chip>
      ) : null}

      {skillsLabel ? (
        <Chip title={t('ai.composer.skills')} testId="composer-skills-pill">
          {t('ai.panel.skills.withVault', { skills: skillsLabel })}
        </Chip>
      ) : null}
    </div>
  )
}
