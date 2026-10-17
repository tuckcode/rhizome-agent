import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { AiActionStatus } from './AiActionCard'
import {
  bashResultRowStatus,
  cutCommand,
  parseBashToolResult,
  trimmedOutputNote,
} from '../lib/bashToolResult'
import { commandHasHiddenChars } from '../lib/visibleCommand'
import { VisibleCommand } from './VisibleCommand'

export interface BashResultCardProps {
  command?: string
  denied?: boolean
  superseded?: boolean
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
  trimmed,
  hiddenLines,
}: {
  content: string
  label: string
  testId: string
  trimmed?: boolean
  hiddenLines?: number
}) {
  if (!content && !trimmed) return null
  return (
    <div className="mt-1.5 first:mt-0">
      <div
        className="mb-0.5 text-[11px] font-medium text-muted-foreground"
        data-testid={`${testId}-label`}
      >
        {label}
      </div>
      {trimmed ? (
        <p className="mb-1 text-[12px] text-muted-foreground" data-testid={`${testId}-trimmed`}>
          {trimmedOutputNote(hiddenLines)}
        </p>
      ) : null}
      {content ? (
        <pre
          className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-[var(--editor-code-block-background)] px-1.5 py-1 font-mono text-[11px] leading-4 text-[var(--editor-code-block-text)]"
          data-testid={testId}
        >
          {content}
        </pre>
      ) : null}
    </div>
  )
}

function BashResultSummary({
  command,
  expanded,
  extra,
  hasHiddenChars,
  onToggle,
  verb,
  verbDanger,
}: {
  command: string
  expanded: boolean
  extra?: { kind: string; text: string; danger: boolean }
  hasHiddenChars: boolean
  onToggle: () => void
  verb: string
  verbDanger: boolean
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-left text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      aria-expanded={expanded}
      data-testid="bash-result-header"
      onClick={onToggle}
    >
      <span className="shrink-0 text-muted-foreground">
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1" data-testid="bash-result-summary">
        <span className={`shrink-0 ${dangerClass(verbDanger) ?? ''}`}>{verb}</span>
        <span className="min-w-0 flex-1 truncate" data-testid="bash-result-command-clip">
          <code className="rounded-sm bg-[var(--syntax-monospace-bg)] px-0.5 font-mono text-[12px]">
            <VisibleCommand command={command} />
          </code>
        </span>
        {hasHiddenChars ? (
          <span
            className="shrink-0 text-[var(--danger-text)]"
            data-testid="bash-result-hidden-chars"
          >
            {' · '}
            has hidden characters
          </span>
        ) : null}
        {extra ? (
          <span className="shrink-0">
            {' · '}
            <span
              className={dangerClass(extra.danger)}
              data-testid={extra.kind === 'exit' ? 'bash-result-exit' : `bash-result-${extra.kind}`}
            >
              {extra.text}
            </span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

function BashResultDetails({
  command,
  stderr,
  stderrHidden,
  stderrTruncated,
  stdout,
  stdoutHidden,
  stdoutTruncated,
}: {
  command?: string
  stderr: string
  stderrHidden?: number
  stderrTruncated: boolean
  stdout: string
  stdoutHidden?: number
  stdoutTruncated: boolean
}) {
  const empty = !stdout && !stderr && !stdoutTruncated && !stderrTruncated && !command
  return (
    <div className="border-t border-border bg-muted/40 px-3 py-2" data-testid="bash-result-details">
      {command ? (
        <div className="mt-1.5 first:mt-0">
          <div
            className="mb-0.5 text-[11px] font-medium text-muted-foreground"
            data-testid="bash-result-command-label"
          >
            command
          </div>
          <pre
            className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-[var(--editor-code-block-background)] px-1.5 py-1 font-mono text-[11px] leading-4 text-[var(--editor-code-block-text)]"
            data-testid="bash-result-command"
          >
            <span
              aria-hidden
              className="select-none text-muted-foreground"
              data-testid="bash-result-prompt"
            >
              $
              {' '}
            </span>
            <VisibleCommand command={command} />
          </pre>
        </div>
      ) : null}
      <OutputBlock
        content={stdout}
        hiddenLines={stdoutHidden}
        label="stdout"
        testId="bash-result-stdout"
        trimmed={stdoutTruncated}
      />
      <OutputBlock
        content={stderr}
        hiddenLines={stderrHidden}
        label="stderr"
        testId="bash-result-stderr"
        trimmed={stderrTruncated}
      />
      {empty ? (
        <p className="text-[12px] text-muted-foreground">No output</p>
      ) : null}
    </div>
  )
}

export function BashResultCard({
  command,
  denied,
  expanded,
  onToggle,
  output,
  status,
  superseded,
}: BashResultCardProps) {
  const result = parseBashToolResult(output)
  const row = bashResultRowStatus(status, result, { denied, superseded })
  const source = command ?? 'command'
  const cut = cutCommand(source)

  return (
    <div
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      data-testid="bash-result-card"
    >
      <BashResultSummary
        command={cut.text}
        expanded={expanded}
        extra={row.extra}
        hasHiddenChars={commandHasHiddenChars(source)}
        onToggle={onToggle}
        verb={row.verb}
        verbDanger={row.verbDanger}
      />
      {expanded ? (
        <BashResultDetails
          command={command}
          stderr={result.stderr}
          stderrHidden={result.stderrLinesHidden}
          stderrTruncated={result.stderrTruncated}
          stdout={result.stdout}
          stdoutHidden={result.stdoutLinesHidden}
          stdoutTruncated={result.stdoutTruncated}
        />
      ) : null}
    </div>
  )
}
