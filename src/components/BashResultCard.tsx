import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { AiActionStatus } from './AiActionCard'
import {
  bashResultRowStatus,
  parseBashToolResult,
  trimmedOutputNote,
  truncateCommand,
} from '../lib/bashToolResult'

export interface BashResultCardProps {
  command?: string
  output?: string
  status: AiActionStatus
  expanded: boolean
  onToggle: () => void
}

function dangerClass(on: boolean): string | undefined {
  return on ? 'text-[var(--danger-text)]' : undefined
}

function OutputBlock({
  content,
  label,
  testId,
}: {
  content: string
  label: string
  testId: string
}) {
  return (
    <div className="mt-1.5 first:mt-0">
      <div
        className="mb-0.5 text-[11px] font-medium text-muted-foreground"
        data-testid={`${testId}-label`}
      >
        {label}
      </div>
      <pre
        className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-[var(--editor-code-block-background)] px-1.5 py-1 font-mono text-[11px] leading-4 text-[var(--editor-code-block-text)]"
        data-testid={testId}
      >
        {content}
      </pre>
    </div>
  )
}

function BashResultSummary({
  command,
  expanded,
  extra,
  onToggle,
  verb,
  verbDanger,
}: {
  command: string
  expanded: boolean
  extra?: { kind: string; text: string; danger: boolean }
  onToggle: () => void
  verb: string
  verbDanger: boolean
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-[12px]"
      aria-expanded={expanded}
      data-testid="bash-result-header"
      onClick={onToggle}
    >
      <span className="shrink-0 text-muted-foreground">
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
      </span>
      <span className="min-w-0 flex-1 truncate" data-testid="bash-result-summary">
        <span className={dangerClass(verbDanger)}>{verb}</span>
        {' '}
        <code className="rounded-sm bg-[var(--syntax-monospace-bg)] px-0.5 font-mono text-[12px]">
          {command}
        </code>
        {extra ? (
          <>
            {' · '}
            <span
              className={dangerClass(extra.danger)}
              data-testid={extra.kind === 'exit' ? 'bash-result-exit' : `bash-result-${extra.kind}`}
            >
              {extra.text}
            </span>
          </>
        ) : null}
      </span>
    </button>
  )
}

function BashResultDetails({
  hiddenLines,
  stderr,
  stdout,
  truncated,
}: {
  hiddenLines?: number
  stderr: string
  stdout: string
  truncated: boolean
}) {
  return (
    <div className="border-t border-border bg-muted/40 px-3 py-2" data-testid="bash-result-details">
      {truncated ? (
        <p className="mb-1.5 text-[12px] text-muted-foreground" data-testid="bash-result-trimmed">
          {trimmedOutputNote(hiddenLines)}
        </p>
      ) : null}
      {stdout ? <OutputBlock content={stdout} label="stdout" testId="bash-result-stdout" /> : null}
      {stderr ? <OutputBlock content={stderr} label="stderr" testId="bash-result-stderr" /> : null}
      {!stdout && !stderr && !truncated ? (
        <p className="text-[12px] text-muted-foreground">No output</p>
      ) : null}
    </div>
  )
}

export function BashResultCard({
  command,
  expanded,
  onToggle,
  output,
  status,
}: BashResultCardProps) {
  const result = parseBashToolResult(output)
  const row = bashResultRowStatus(status, result, output)
  const displayCommand = command ? truncateCommand(command) : 'command'

  return (
    <div
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      data-testid="bash-result-card"
    >
      <BashResultSummary
        command={displayCommand}
        expanded={expanded}
        extra={row.extra}
        onToggle={onToggle}
        verb={row.verb}
        verbDanger={row.verbDanger}
      />
      {expanded ? (
        <BashResultDetails
          hiddenLines={result.hiddenLines}
          stderr={result.stderr}
          stdout={result.stdout}
          truncated={result.truncated}
        />
      ) : null}
    </div>
  )
}
