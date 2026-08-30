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
import { PRODUCT_AI_AGENT_DEFINITIONS } from '../lib/aiAgents'
import { trackComposerPillOpened } from '../lib/productAnalytics'
import { PrimeModelPicker } from './PrimeModelPicker'
import { PrimeThinkingToggle } from './PrimeThinkingToggle'

export interface ComposerVaultOption {
  label: string
  path: string
}

interface ChatComposerDeckProps {
  locale?: AppLocale
  vaultLabel?: string | null
  skillsLabel?: string | null
  /** Frame B — the note open in the secondary pane. */
  contextLabel?: string | null
  /** Stop sending the open note. Without it the pill stays a plain label. */
  onCloseContext?: () => void
  model?: string | null
  thinkingLevel?: string | null
  vaultPath?: string
  vaults?: readonly ComposerVaultOption[]
  onSwitchVault?: (path: string) => void
}

function pillClass(accent = false) {
  return cn(
    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5',
    'font-mono text-[11px] transition-colors',
    'border-[var(--border-default,var(--border))]',
    'hover:bg-[var(--state-hover,var(--accent))] hover:text-foreground',
    accent ? 'border-[var(--accent-green)]/40 text-foreground' : 'text-muted-foreground',
  )
}

function Chip({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5',
        'font-mono text-[11px] text-muted-foreground border-border',
      )}
    >
      {children}
    </span>
  )
}

/**
 * Frame A's composer control strip (#38 / #9 / #35).
 *
 * This is where a turn is configured: agent, model, reasoning depth, vault,
 * skills. Pills are DropdownMenu triggers (caret, hover, 999px) except the
 * thinking toggle, which is one click so the next turn's depth is obvious
 * without a menu. The telemetry subhead keeps status (live, session, uptime)
 * and does not duplicate these controls.
 */
export function ChatComposerDeck({
  locale = 'en',
  vaultLabel,
  skillsLabel,
  contextLabel,
  onCloseContext,
  model,
  thinkingLevel,
  vaultPath,
  vaults = [],
  onSwitchVault,
}: ChatComposerDeckProps) {
  const t = createTranslator(locale)
  const agent = PRODUCT_AI_AGENT_DEFINITIONS[0]
  const vaultOptions = vaults.length > 0
    ? vaults
    : (vaultPath && vaultLabel ? [{ label: vaultLabel, path: vaultPath }] : [])
  const skillNames = skillsLabel ? skillsLabel.split(/,\s*/).filter(Boolean) : []

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="chat-composer-deck">
      <DropdownMenu onOpenChange={(open) => { if (open) trackComposerPillOpened('agent') }}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={pillClass(true)}
            aria-label={t('ai.composer.agent')}
            data-testid="composer-agent-pill"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent-green)]" />
            {t('ai.panel.title')}
            <CaretDown size={9} weight="bold" className="text-[var(--text-faint,var(--muted-foreground))]" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-48">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {t('ai.composer.agent')}
          </DropdownMenuLabel>
          {PRODUCT_AI_AGENT_DEFINITIONS.map((definition) => (
            <DropdownMenuItem
              key={definition.id}
              className="text-[12px]"
              data-testid={`composer-agent-${definition.id}`}
            >
              {definition.shortLabel}
              {definition.id === agent?.id ? ` · ${t('ai.composer.current')}` : ''}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
        />
      </span>

      <PrimeThinkingToggle
        locale={locale}
        thinkingLevel={thinkingLevel}
        vaultPath={vaultPath}
      />

      {vaultLabel ? (
        <DropdownMenu onOpenChange={(open) => { if (open) trackComposerPillOpened('vault') }}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={pillClass()}
              aria-label={t('ai.composer.vault')}
              title={t('ai.composer.vault')}
              data-testid="composer-vault-pill"
            >
              {vaultLabel}
              <CaretDown size={9} weight="bold" className="text-[var(--text-faint,var(--muted-foreground))]" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {t('ai.composer.vault')}
            </DropdownMenuLabel>
            {vaultOptions.map((vault) => (
              <DropdownMenuItem
                key={vault.path}
                className="text-[12px]"
                data-testid={`composer-vault-${vault.path}`}
                onSelect={() => onSwitchVault?.(vault.path)}
              >
                {vault.label}
                {vault.path === vaultPath ? ` · ${t('ai.composer.current')}` : ''}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

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
            >
              {t('ai.composer.context', { note: contextLabel })}
              <CaretDown size={9} weight="bold" className="text-[var(--text-faint,var(--muted-foreground))]" aria-hidden="true" />
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
        <Chip>{t('ai.composer.context', { note: contextLabel })}</Chip>
      ) : null}

      {skillsLabel ? (
        <DropdownMenu onOpenChange={(open) => { if (open) trackComposerPillOpened('skills') }}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={pillClass()}
              aria-label={t('ai.composer.skills')}
              data-testid="composer-skills-pill"
            >
              {t('ai.panel.skills.withVault', { skills: skillsLabel })}
              <CaretDown size={9} weight="bold" className="text-[var(--text-faint,var(--muted-foreground))]" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {t('ai.composer.skills')}
            </DropdownMenuLabel>
            {skillNames.map((name) => (
              <DropdownMenuItem key={name} disabled className="text-[12px]">
                {name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem disabled className="text-[12px] text-muted-foreground">
              {t('ai.panel.skills.default')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
