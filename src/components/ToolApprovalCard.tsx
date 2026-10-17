import { useLayoutEffect, useRef, useState, type UIEvent } from 'react'
import { Copy, FilePlus, NotePencil, PencilSimple, Terminal } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DiffView } from './DiffView'
import { APPROVAL_COLLAPSE_AFTER, compactDiffLines } from './approvalDiff'
import { writeClipboardText } from '../utils/clipboardText'
import { bashTimeoutLabel } from '../lib/bashToolResult'
import {
  approvalTitle,
  isBashTool,
  previewLooksCreated,
  type NativeApprovalChoice,
  type NativeApprovalOption,
} from '../lib/nativeToolApproval'
import { commandHasHiddenChars } from '../lib/visibleCommand'
import { VisibleCommand } from './VisibleCommand'

export interface ToolApprovalCardProps {
  tool: string
  path?: string
  preview?: string
  notes?: string[]
  capped?: boolean
  created?: boolean
  overwrite?: boolean
  command?: string
  timeoutSecs?: number
  options: NativeApprovalOption[]
  busy?: boolean
  onReply: (choice: NativeApprovalChoice) => void
}

function ToolGlyph({ created, tool }: { created: boolean; tool: string }) {
  if (isBashTool(tool)) return <Terminal size={14} />
  if (tool === 'write_file' && created) return <FilePlus size={14} />
  if (tool === 'edit_file') return <NotePencil size={14} />
  return <PencilSimple size={14} />
}

function optionVariant(id: string): 'default' | 'outline' | 'ghost' {
  if (id === 'allow_once') return 'default'
  if (id === 'deny') return 'ghost'
  return 'outline'
}

const NEAR_EDGE_PX = 1

function hasMoreBelow(el: HTMLElement): boolean {
  const canScroll = el.scrollHeight > el.clientHeight + NEAR_EDGE_PX
  if (!canScroll) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight > NEAR_EDGE_PX
}

export function ToolApprovalCard({
  busy = false,
  capped = false,
  command,
  created: createdProp,
  notes = [],
  onReply,
  options,
  overwrite: overwriteProp,
  path,
  preview,
  timeoutSecs,
  tool,
}: ToolApprovalCardProps) {
  const created = createdProp ?? previewLooksCreated(preview)
  const overwrite = overwriteProp ?? (tool === 'write_file' && !created)
  const bash = isBashTool(tool)
  const title = approvalTitle(tool, created)
  const [expanded, setExpanded] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [moreBelow, setMoreBelow] = useState(true)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const lineCount = compactDiffLines(preview ?? '').length
  const overflows = !bash && !expanded && lineCount > APPROVAL_COLLAPSE_AFTER

  function syncScroll(el: HTMLElement) {
    setScrollTop(el.scrollTop)
    setMoreBelow(hasMoreBelow(el))
  }

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (el) syncScroll(el)
  }, [preview, expanded, overflows])

  function onDiffScroll(event: UIEvent<HTMLDivElement>) {
    syncScroll(event.currentTarget)
  }

  function expandDiff() {
    setExpanded(true)
  }

  function choose(optionId: string) {
    onReply(optionId as NativeApprovalChoice)
  }

  const showTopFade = overflows && scrollTop > 0
  const showBottomFade = overflows && moreBelow
  // Shell runner omits allow_session for bash. Filter here too so main,
  // which still sends it, asks every run in v1.
  const visibleOptions = bash
    ? options.filter((option) => option.id !== 'allow_session')
    : options

  return (
    <section
      aria-label={`${title} approval`}
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      data-testid="tool-approval-card"
    >
      <header className="flex items-start gap-2 px-3 py-2.5">
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          <ToolGlyph created={created} tool={tool} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
            <span
              className="font-sans text-[11px] text-muted-foreground"
              data-testid="approval-status"
            >
              Needs approval
            </span>
          </div>
          {!bash && path ? (
            <p
              className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground"
              data-testid="approval-path"
              title={path}
            >
              {path}
            </p>
          ) : null}
          {!bash && created ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground" data-testid="approval-new-file">
              New file
            </p>
          ) : null}
          {overwrite && tool === 'write_file' ? (
            <p
              className="mt-0.5 text-[12px] text-[var(--warn-text)]"
              data-testid="approval-overwrite"
            >
              Replaces the whole file
            </p>
          ) : null}
        </div>
      </header>
      {bash ? (
        <BashApprovalBody command={command ?? ''} timeoutSecs={timeoutSecs} />
      ) : (
        <div className="relative border-y border-border bg-muted/40">
          <div
            ref={scrollerRef}
            className={expanded ? 'overflow-auto' : 'max-h-64 overflow-auto'}
            data-testid="approval-diff"
            onScroll={onDiffScroll}
          >
            <div className={overflows ? 'pb-14' : undefined}>
              <DiffView compact diff={preview ?? ''} />
            </div>
          </div>
          {showTopFade ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-card to-transparent"
              data-testid="approval-diff-fade-top"
            />
          ) : null}
          {overflows ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end">
              {showBottomFade ? (
                <div className="h-10 bg-gradient-to-t from-card to-transparent" data-testid="approval-diff-fade" />
              ) : null}
              <div className="pointer-events-auto bg-card px-3 pb-2">
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  data-testid="approval-show-all"
                  onClick={expandDiff}
                >
                  {capped ? 'Show full preview' : `Show all ${lineCount} lines`}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {notes.length > 0 ? (
        <ul
          className="space-y-0.5 px-3 py-2 text-[12px] text-muted-foreground"
          data-testid="approval-notes"
        >
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <footer className="flex flex-wrap items-center justify-end gap-1.5 px-3 py-2">
        {visibleOptions.map((option) => (
          <Button
            key={option.id}
            disabled={busy}
            size="sm"
            type="button"
            variant={optionVariant(option.id)}
            className={[
              option.id === 'deny' ? 'text-destructive hover:text-destructive' : '',
              option.id === 'allow_once'
                ? 'focus-visible:ring-offset-2 focus-visible:ring-offset-card'
                : '',
            ].filter(Boolean).join(' ')}
            data-testid={`approval-${option.id}`}
            onClick={function onChoose() {
              choose(option.id)
            }}
          >
            {option.label}
          </Button>
        ))}
      </footer>
    </section>
  )
}

function BashApprovalBody({
  command,
  timeoutSecs,
}: {
  command: string
  timeoutSecs?: number
}) {
  function copyCommand() {
    if (!command) return
    void writeClipboardText(command).catch(() => {})
  }

  const hidden = commandHasHiddenChars(command)

  return (
    <div className="border-y border-border bg-muted/40 px-3 py-2">
      <div className="relative">
        <pre
          className="max-h-64 overflow-auto whitespace-pre-wrap break-words pr-11 font-mono text-[12px] leading-5 text-foreground"
          data-testid="approval-command"
        >
          <VisibleCommand command={command} />
        </pre>
        {command ? (
          <Button
            aria-label="Copy command"
            className="absolute right-0 top-0"
            data-testid="approval-copy-command"
            size="icon-xs"
            type="button"
            variant="ghost"
            onClick={copyCommand}
          >
            <Copy size={14} />
          </Button>
        ) : null}
      </div>
      {hidden ? (
        <p className="mt-2 text-[12px] text-[var(--danger-text)]" data-testid="approval-hidden-warning">
          This command contains hidden or control characters.
        </p>
      ) : null}
      <p className="mt-2 text-[12px] text-muted-foreground" data-testid="approval-vault-note">
        Runs in your vault folder. Output is shown when it finishes.
      </p>
      <p className="mt-0.5 text-[12px] text-muted-foreground" data-testid="approval-timeout">
        {bashTimeoutLabel(timeoutSecs)}
      </p>
    </div>
  )
}
