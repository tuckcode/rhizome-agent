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
import { stopRunAriaKeyShortcuts, stopRunShortcutLabel } from '../hooks/useStopRunShortcut'
import type { ChatRunActionKind, ChatRunFailure, ChatRunState } from '../lib/chatRunStatus'

interface ChatRunStatusLineProps {
  messages: Parameters<typeof useChatRunStatus>[0]
  isActive: boolean
  failure?: ChatRunFailure | null
  onStop?: () => void
  onContinue?: () => void
  onSignIn?: () => void
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
 * A ghost button in the foreground color, so the action reads apart from
 * the tinted status text beside it.
 */
const ACTION_CLASS = 'ml-1 h-6 px-2 font-semibold text-foreground hover:bg-accent'

/**
 * The one visible place that says what the run does now. It sits above
 * the composer and keeps its height when idle, so the composer does not
 * move when a run starts or ends.
 *
 * Only a failure is a live region here. ChatRunLiveStatus announces the
 * other run events once.
 */
export function ChatRunStatusLine({
  messages,
  isActive,
  failure = null,
  onStop,
  onContinue,
  onSignIn,
}: ChatRunStatusLineProps) {
  const status = useChatRunStatus(messages, isActive, failure)
  const Glyph = status.state === 'idle' ? null : GLYPH[status.state]
  const handlers: Record<ChatRunActionKind, (() => void) | undefined> = {
    stop: onStop,
    continue: onContinue,
    sign_in: onSignIn,
  }
  const action = status.action
  const onAction = action ? handlers[action.kind] : undefined

  return (
    <div
      className={`flex h-6 min-w-0 items-center gap-1 px-1 text-sm ${TONE[status.state]}`}
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
        <span
          className="flex min-w-0 items-baseline"
          role={status.state === 'failed' ? 'status' : undefined}
        >
          <span className="min-w-0 truncate">{status.label}</span>
          {status.detail ? (
            <>
              <span aria-hidden="true" className="shrink-0 whitespace-pre"> · </span>
              <span className="shrink-0 font-mono tabular-nums">{status.detail}</span>
            </>
          ) : null}
        </span>
      ) : null}
      {action && onAction ? (
        <Button
          aria-keyshortcuts={action.kind === 'stop' ? stopRunAriaKeyShortcuts() : undefined}
          className={ACTION_CLASS}
          data-testid={`chat-run-action-${action.kind}`}
          size="xs"
          type="button"
          variant="ghost"
          onClick={onAction}
        >
          {action.label}
          {action.kind === 'stop' ? (
            <kbd className="font-sans text-xs font-normal text-muted-foreground">{stopRunShortcutLabel()}</kbd>
          ) : null}
        </Button>
      ) : null}
    </div>
  )
}
