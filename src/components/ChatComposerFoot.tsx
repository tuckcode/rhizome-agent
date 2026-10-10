import { CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface ChatComposerFootProps {
  working?: boolean
  /** Reason a Prime session worker failed to start. Shown in place of turn status. */
  failureReason?: string | null
}

/**
 * Turn status inside ChatComposerBar. Rendered only while a turn runs —
 * idle is the normal state and says nothing (native audit 2026-09-26).
 * Tool names live on the assistant message Reasoning block, not here.
 * Key hints live on the Send button's tooltip. There is no stop hint:
 * Escape leaves Chat (useAiPanelFocus), and Stop is click-only.
 */
export function ChatComposerFoot({
  working = false,
  failureReason = null,
}: ChatComposerFootProps) {
  if (failureReason) {
    return (
      <span
        data-testid="chat-composer-foot"
        role="status"
        className="min-w-0 truncate font-mono text-[12px] tracking-[0.03em] text-destructive"
      >
        {failureReason}
      </span>
    )
  }

  if (!working) return null

  return (
    <span
      data-testid="chat-composer-foot"
      role="status"
      aria-label="Working"
      className={cn(
        'inline-flex shrink-0 items-center text-primary',
      )}
    >
      <CircleNotch size={12} className="animate-spin" aria-hidden="true" />
    </span>
  )
}
