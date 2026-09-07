import { useCallback, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { callHost } from '../lib/callHost'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { thinkingLevelIsLoud, thinkingLevelLabel } from '../lib/primeThinkingLevels'
import { trackPrimeThinkingLevelChanged } from '../lib/productAnalytics'

interface PrimeThinkingToggleProps {
  locale?: AppLocale
  thinkingLevel?: string | null
  vaultPath?: string
  disabled?: boolean
}

/**
 * Composer thinking-level pill. Opens a menu of every level the host offers
 * (`get_prime_thinking_levels`) so Off → Max are one click away — not just a
 * quiet/loud toggle. The model picker still lists the same scale.
 */
export function PrimeThinkingToggle({
  locale = 'en',
  thinkingLevel,
  vaultPath,
  disabled = false,
}: PrimeThinkingToggleProps) {
  const t = createTranslator(locale)
  const [error, setError] = useState<string | null>(null)
  const [levels, setLevels] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const loud = thinkingLevelIsLoud(thinkingLevel)
  const label = thinkingLevelLabel(thinkingLevel) ?? t('ai.composer.thinkingToggle')

  const loadLevels = useCallback(async () => {
    try {
      if (vaultPath) {
        await callHost('ensure_prime_session_host', { vaultPath })
      }
      const listed = await callHost<string[]>('get_prime_thinking_levels')
      setLevels(Array.isArray(listed) ? listed.filter(Boolean) : [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLevels([])
    }
  }, [vaultPath])

  const selectLevel = useCallback(async (level: string) => {
    if (disabled) return
    try {
      if (vaultPath) {
        await callHost('ensure_prime_session_host', { vaultPath })
      }
      await callHost('set_prime_thinking_level', { level })
      trackPrimeThinkingLevelChanged(level, 'pill')
      setError(null)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [disabled, vaultPath])

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (disabled) return
        setOpen(next)
        if (next) void loadLevels()
      }}
    >
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={loud}
          aria-label={t('ai.composer.thinkingToggleAria', { level: label })}
          title={error ?? t('ai.composer.thinkingToggleHint')}
          data-testid="prime-thinking-toggle"
          className={cn(
            'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5',
            'font-mono text-[11px] transition-colors',
            'border-[var(--border-default,var(--border))]',
            loud
              ? 'border-[var(--accent-green)]/40 bg-[var(--accent-green)]/10 text-foreground'
              : 'text-muted-foreground hover:bg-[var(--state-hover,var(--accent))] hover:text-foreground',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-40" data-testid="prime-thinking-pill-menu">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {t('ai.subhead.thinking')}
        </DropdownMenuLabel>
        {levels.length === 0 ? (
          <DropdownMenuItem disabled className="text-[12px] text-muted-foreground">
            {error ?? t('ai.composer.thinkingToggle')}
          </DropdownMenuItem>
        ) : (
          levels.map((level) => (
            <DropdownMenuItem
              key={level}
              onSelect={() => void selectLevel(level)}
              className="text-[12px]"
              data-testid={`prime-thinking-pill-${level}`}
              data-selected={level === (thinkingLevel ?? '') ? 'true' : undefined}
            >
              <span className="truncate">{thinkingLevelLabel(level)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
