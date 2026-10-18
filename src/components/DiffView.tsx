import { cn } from '@/lib/utils'

interface DiffViewProps {
  diff: string
  compact?: boolean
}

const DIFF_HEADER_PREFIXES = ['diff', 'index', '---', '+++', 'new file']

function diffKind(line: string): 'added' | 'removed' | 'hunk' | 'header' | 'context' {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'added'
  if (line.startsWith('-') && !line.startsWith('---')) return 'removed'
  if (line.startsWith('@@')) return 'hunk'
  if (DIFF_HEADER_PREFIXES.some((p) => line.startsWith(p))) return 'header'
  return 'context'
}

function classifyDiffLine(line: string, compact: boolean): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'bg-[var(--diff-added-bg)] text-[var(--diff-added-text)]'
  if (line.startsWith('-') && !line.startsWith('---')) return 'bg-[var(--diff-removed-bg)] text-[var(--diff-removed-text)]'
  if (line.startsWith('@@')) {
    return compact
      ? 'bg-[var(--surface-button)] text-muted-foreground'
      : 'bg-[var(--diff-hunk-bg)] text-primary italic'
  }
  if (DIFF_HEADER_PREFIXES.some((p) => line.startsWith(p))) return 'bg-muted text-muted-foreground font-semibold'
  return 'text-secondary-foreground'
}

function DiffLine({
  compact,
  line,
  lineNumber,
}: {
  compact: boolean
  line: string
  lineNumber: number
}) {
  return (
    <div
      data-diff-kind={diffKind(line)}
      className={cn('flex min-h-[22px]', compact ? 'px-2' : 'px-4', classifyDiffLine(line, compact))}
    >
      {compact ? null : (
        <span className="w-10 shrink-0 text-right pr-3 text-muted-foreground select-none">{lineNumber}</span>
      )}
      <span className="flex-1 whitespace-pre-wrap break-all px-2">{line || '\u00A0'}</span>
    </div>
  )
}

function dropLeadingFileHeaders(lines: string[]): string[] {
  if (lines.length >= 2 && lines[0].startsWith('---') && lines[1].startsWith('+++')) {
    return lines.slice(2)
  }
  return lines
}

function visibleDiffLines(diff: string, compact: boolean): string[] {
  const lines = diff.split('\n')
  if (!compact) return lines
  return dropLeadingFileHeaders(lines.filter((line) => line.length > 0))
}

export function DiffView({ compact = false, diff }: DiffViewProps) {
  if (!diff) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No changes to display
      </div>
    )
  }

  const lines = visibleDiffLines(diff, compact)

  return (
    <div className={cn('font-mono leading-relaxed', compact ? 'py-1 text-[12px]' : 'py-3 text-[13px]')}>
      {lines.map((line, i) => (
        <DiffLine compact={compact} key={`${i}:${line}`} line={line} lineNumber={i + 1} />
      ))}
    </div>
  )
}

