import { useCallback, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { callHost, callHostOr } from '../lib/callHost'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { offeredThinkingLevels, thinkingLevelIsLoud, thinkingLevelLabel } from '../lib/primeThinkingLevels'
import { trackPrimeThinkingLevelChanged } from '../lib/productAnalytics'

interface PrimeThinkingToggleProps {
  locale?: AppLocale
  thinkingLevel?: string | null
  vaultPath?: string
  disabled?: boolean
}

/**
 * Composer thinking-level pill. Opens a menu of the levels the attached model
 * can actually run, so Off → Max are one click away when the model has them —
 * not just a quiet/loud toggle. The model picker lists the same set.
 *
 * The host's scale is `get_prime_thinking_levels`; the subset is
 * `get_prime_supported_thinking_levels`, which reads the model's own
 * `thinkingLevelMap`. Prime clamps every pick to that subset, so a menu drawn
 * from the full scale offers clicks that do nothing: on `deepseek-v4-flash`
 * (`{minimal, low, medium, max} = null`) picking Medium landed on High and the
 * pill looked stuck. When the menu is narrowed, it says so, because a missing
 * level with no explanation is the same dead end in a quieter form.
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
  const [restricted, setRestricted] = useState(false)
  const [open, setOpen] = useState(false)
  const loud = thinkingLevelIsLoud(thinkingLevel)
  const label = thinkingLevelLabel(thinkingLevel) ?? t('ai.composer.thinkingToggle')

  const loadLevels = useCallback(async () => {
    try {
      if (vaultPath) {
        await callHost('ensure_prime_session_host', { vaultPath })
      }
      // Two lists, both cheap: the host's full scale, and the model's subset
      // of it. The subset is read through `callHostOr` on purpose — an
      // unreadable answer must widen the menu back to the scale, never
      // narrow it to nothing.
      const [listed, supported] = await Promise.all([
        callHost<string[]>('get_prime_thinking_levels'),
        callHostOr<string[]>('get_prime_supported_thinking_levels', []),
      ])
      const scale = Array.isArray(listed) ? listed.filter(Boolean) : []
      const offered = offeredThinkingLevels(scale, Array.isArray(supported) ? supported : [])
      setLevels(offered)
      setRestricted(offered.length < scale.length)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLevels([])
      setRestricted(false)
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
          <>
            {levels.map((level) => (
              <DropdownMenuItem
                key={level}
                onSelect={() => void selectLevel(level)}
                className="text-[12px]"
                data-testid={`prime-thinking-pill-${level}`}
                data-selected={level === (thinkingLevel ?? '') ? 'true' : undefined}
              >
                <span className="truncate">{thinkingLevelLabel(level)}</span>
              </DropdownMenuItem>
            ))}
            {restricted ? (
              <DropdownMenuItem
                disabled
                className="text-[12px] text-muted-foreground"
                data-testid="prime-thinking-pill-model-limited"
              >
                {t('ai.composer.thinkingModelLimited')}
              </DropdownMenuItem>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
