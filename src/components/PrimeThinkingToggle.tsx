import { useCallback, useState } from 'react'
import { callHost } from '../lib/callHost'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { nextThinkingToggleLevel, thinkingLevelIsLoud, thinkingLevelLabel } from '../lib/primeThinkingLevels'
import { trackPrimeThinkingLevelChanged } from '../lib/productAnalytics'

interface PrimeThinkingToggleProps {
  locale?: AppLocale
  thinkingLevel?: string | null
  vaultPath?: string
  disabled?: boolean
}

/**
 * One-click reasoning-depth toggle on the composer (#35).
 *
 * Click cycles between a quiet host level and a loud one. The full seven
 * remain in the model menu; this control exists so the next turn's depth is
 * visible and reachable without opening that menu.
 */
export function PrimeThinkingToggle({
  locale = 'en',
  thinkingLevel,
  vaultPath,
  disabled = false,
}: PrimeThinkingToggleProps) {
  const t = createTranslator(locale)
  const [error, setError] = useState<string | null>(null)
  const loud = thinkingLevelIsLoud(thinkingLevel)
  const label = thinkingLevelLabel(thinkingLevel) ?? t('ai.composer.thinkingToggle')

  const toggle = useCallback(async () => {
    if (disabled) return
    try {
      if (vaultPath) {
        await callHost('ensure_prime_session_host', { vaultPath })
      }
      const levels = await callHost<string[]>('get_prime_thinking_levels')
      const next = nextThinkingToggleLevel(thinkingLevel, Array.isArray(levels) ? levels : [])
      if (!next) return
      await callHost('set_prime_thinking_level', { level: next })
      trackPrimeThinkingLevelChanged(next, 'toggle')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [disabled, thinkingLevel, vaultPath])

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={loud}
      aria-label={t('ai.composer.thinkingToggleAria', { level: label })}
      title={error ?? t('ai.composer.thinkingToggleHint')}
      data-testid="prime-thinking-toggle"
      onClick={() => void toggle()}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5',
        'font-mono text-[10.5px] transition-colors',
        'border-[var(--border-default,var(--border))]',
        loud
          ? 'border-[var(--accent-green)]/40 bg-[var(--accent-green)]/10 text-foreground'
          : 'text-muted-foreground hover:bg-[var(--state-hover,var(--accent))] hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {label}
    </button>
  )
}
