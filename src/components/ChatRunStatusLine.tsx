import {
  CircleNotch,
  HandPalm,
  Hourglass,
  Pause,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useChatRunStatus } from '../hooks/useChatRunStatus'
import type { ChatRunState } from '../lib/chatRunStatus'

interface ChatRunStatusLineProps {
  messages: Parameters<typeof useChatRunStatus>[0]
  isActive: boolean
  failureReason?: string | null
  onStop?: () => void
}

const GLYPH: Record<Exclude<ChatRunState, 'idle'>, Icon> = {
  thinking: CircleNotch,
  writing: CircleNotch,
  tool: CircleNotch,
  approval: HandPalm,
  quiet: Hourglass,
  capped: Pause,
  failed: WarningCircle,
}

const TONE: Record<ChatRunState, string> = {
  idle: 'text-muted-foreground',
  thinking: 'text-muted-foreground',
  writing: 'text-muted-foreground',
  tool: 'text-muted-foreground',
  approval: 'text-warn-text',
  quiet: 'text-warn-text',
  capped: 'text-muted-foreground',
  failed: 'text-danger-text',
}

const SPINS: ReadonlySet<ChatRunState> = new Set(['thinking', 'writing', 'tool'])

/**
 * The one visible place that says what the run does now. It sits above
 * the composer and keeps its height when idle, so the composer does not
 * move when a run starts or ends.
 *
 * It is not a live region. ChatRunLiveStatus announces run events once.
 */
export function ChatRunStatusLine({
  messages,
  isActive,
  failureReason = null,
  onStop,
}: ChatRunStatusLineProps) {
  const status = useChatRunStatus(messages, isActive, failureReason)
  const Glyph = status.state === 'idle' ? null : GLYPH[status.state]

  return (
    <div
      className={`flex h-6 min-w-0 items-center gap-1.5 px-1 text-sm ${TONE[status.state]}`}
      data-run-state={status.state}
      data-testid="chat-run-status-line"
    >
      {Glyph ? (
        <Glyph
          aria-hidden="true"
          className={SPINS.has(status.state) ? 'shrink-0 motion-safe:animate-spin' : 'shrink-0'}
          size={13}
        />
      ) : null}
      {status.label ? (
        <span className="min-w-0 truncate">
          {status.label}
          {status.detail ? <span className="font-mono"> · {status.detail}</span> : null}
        </span>
      ) : null}
      {status.state === 'quiet' && onStop ? (
        <Button
          className="h-5 px-1.5"
          size="xs"
          type="button"
          variant="ghost"
          onClick={onStop}
        >
          Stop
        </Button>
      ) : null}
    </div>
  )
}
