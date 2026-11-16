import { Terminal } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { SESSION_HARNESS_LABEL, type SessionHarness } from '../lib/sessionHarness'
import { BrandMark } from './BrandMark'

interface HarnessMarkerProps {
  harness: SessionHarness
  size?: number
  className?: string
  /** Hide from assistive tech when the parent already carries the name. */
  decorative?: boolean
}

/**
 * Small marker for the harness that runs a chat (ADR-0191 decision 4).
 * Rhizome shows its own mark. Claude Code shows a neutral Phosphor
 * `Terminal` glyph with the plain text "Claude Code" as tooltip and
 * accessible name: no Anthropic logo, Claude mark, or brand color.
 */
export function HarnessMarker({ harness, size = 12, className, decorative = false }: HarnessMarkerProps) {
  const label = SESSION_HARNESS_LABEL[harness]
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center text-muted-foreground', className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      title={label}
      data-testid={`harness-marker-${harness}`}
    >
      {harness === 'claude_code' ? (
        <Terminal size={size} weight="regular" aria-hidden="true" />
      ) : (
        <BrandMark size={size} />
      )}
    </span>
  )
}
