import type { ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { CHAT_FOCUS_RING_CLASS } from '../lib/chatFocusRing'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AiModelProvider } from '../lib/aiTargets'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackComposerPillOpened } from '../lib/productAnalytics'
import { NativeChatModelPicker } from './NativeChatModelPicker'

interface ChatComposerDeckProps {
  locale?: AppLocale
  /** Frame B — the note open in the secondary pane. */
  contextLabel?: string | null
  /** Stop sending the open note. Without it the pill stays a plain label. */
  onCloseContext?: () => void
  vaultPath?: string
  /** Agent activity — idle/working pill on the composer row. */
  activity?: ReactNode
  /** Rhizome vs Prime catalog for the native model chip. */
  catalog?: 'prime' | 'rhizome'
  nativeTarget?: string | null
  onNativeTargetChange?: (target: string) => void
  providers?: AiModelProvider[] | null
  onOpenProviders?: () => void
  nativeLiveSlot?: string | null
}

function pillClass(accent = false) {
  return cn(
    'inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5',
    'font-mono text-[11px] transition-colors',
    CHAT_FOCUS_RING_CLASS,
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
 * Live turn controls on the compact composer row (#38, native audit
 * 2026-09-26): model chip, active agents, and the open note.
 *
 * The model chip is always NativeChatModelPicker.
 */
export function ChatComposerDeck({
  locale = 'en',
  contextLabel,
  onCloseContext,
  vaultPath,
  activity,
  catalog = 'prime',
  nativeTarget,
  onNativeTargetChange,
  providers,
  onOpenProviders,
  nativeLiveSlot,
}: ChatComposerDeckProps) {
  const t = createTranslator(locale)
  const rhizome = catalog === 'rhizome'

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="chat-composer-deck">
      <span
        onPointerDown={() => trackComposerPillOpened('model')}
      >
        <NativeChatModelPicker
          locale={locale}
          engine={rhizome ? 'native' : 'prime'}
          vaultPath={vaultPath}
          value={nativeTarget}
          onChange={(target) => onNativeTargetChange?.(target)}
          providers={providers}
          variant="chip"
          onOpenProviders={onOpenProviders}
          nativeLiveSlot={nativeLiveSlot}
        />
      </span>

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

    </div>
  )
}
