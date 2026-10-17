import { type KeyboardEvent, useCallback } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { AiActionStatus } from './AiActionCard'
import { parseBashToolResult, truncateCommand } from '../lib/bashToolResult'
import { commandFromToolArgs } from '../lib/nativeToolApproval'

export interface BashResultCardProps {
  command?: string
  input?: string
  output?: string
  status: AiActionStatus
  expanded: boolean
  onToggle: () => void
}

interface ResultStatus {
  kind: 'exit' | 'timed-out' | 'stopped'
  text: string
  failed?: boolean
}

function resolvedCommand(command?: string, input?: string, output?: string): string {
  return command
    ?? commandFromToolArgs(input)
    ?? commandFromToolArgs(output)
    ?? ''
}

function resultStatus(result: ReturnType<typeof parseBashToolResult>): ResultStatus | null {
  if (result.timedOut) return { kind: 'timed-out', text: 'timed out' }
  if (result.cancelled) return { kind: 'stopped', text: 'stopped' }
  if (result.exitCode === undefined) return null
  return {
    kind: 'exit',
    text: `exit ${result.exitCode}`,
    failed: result.exitCode !== 0,
  }
}

function OutputBlock({
  content,
  label,
  testId,
}: {
  content: string
  label?: string
  testId: string
}) {
  return (
    <div className="mt-1.5 first:mt-0">
      {label ? (
        <div
          className="mb-0.5 text-[11px] font-medium text-muted-foreground"
          data-testid={`${testId}-label`}
        >
          {label}
        </div>
      ) : null}
      <pre
        className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted px-1.5 py-1 font-mono text-[11px] leading-4 text-foreground"
        data-testid={testId}
      >
        {content}
      </pre>
    </div>
  )
}

export function BashResultCard({
  command,
  expanded,
  input,
  onToggle,
  output,
  status,
}: BashResultCardProps) {
  const result = parseBashToolResult(output)
  const rawCommand = resolvedCommand(command, input, output)
  const displayCommand = rawCommand ? truncateCommand(rawCommand) : 'command'
  const extra = status === 'pending' ? null : resultStatus(result)
  const verb = status === 'pending' ? 'Running' : 'Ran'

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      onToggle()
    }
  }, [expanded, onToggle])

  return (
    <div
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      data-testid="bash-result-card"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-[12px]"
        aria-expanded={expanded}
        data-testid="bash-result-header"
        onClick={onToggle}
        onKeyDown={onKeyDown}
      >
        <span className="shrink-0 text-muted-foreground">
          {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
        </span>
        <span className="min-w-0 flex-1 truncate" data-testid="bash-result-summary">
          {verb}{' '}
          <code className="rounded-sm bg-[var(--syntax-monospace-bg)] px-0.5 font-mono text-[12px]">
            {displayCommand}
          </code>
          {extra ? (
            <>
              {' · '}
              <span
                className={extra.failed ? 'text-[var(--danger-text)]' : undefined}
                data-testid={extra.kind === 'exit' ? 'bash-result-exit' : `bash-result-${extra.kind}`}
              >
                {extra.text}
              </span>
            </>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-border bg-muted/40 px-3 py-2" data-testid="bash-result-details">
          {result.truncated ? (
            <p className="mb-1.5 text-[12px] text-muted-foreground" data-testid="bash-result-trimmed">
              Output trimmed (start and end shown)
            </p>
          ) : null}
          {result.stdout ? <OutputBlock content={result.stdout} testId="bash-result-stdout" /> : null}
          {result.stderr ? (
            <OutputBlock content={result.stderr} label="stderr" testId="bash-result-stderr" />
          ) : null}
          {!result.stdout && !result.stderr && !result.truncated ? (
            <p className="text-[12px] text-muted-foreground">No output</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
