import { useLayoutEffect, useRef, useState, type UIEvent } from 'react'
import { FilePlus, NotePencil, PencilSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DiffView } from './DiffView'
import { APPROVAL_COLLAPSE_AFTER, compactDiffLines } from './approvalDiff'
import {
  approvalTitle,
  previewLooksCreated,
  type NativeApprovalChoice,
  type NativeApprovalOption,
} from '../lib/nativeToolApproval'

export interface ToolApprovalCardProps {
  tool: string
  path?: string
  preview?: string
  created?: boolean
  overwrite?: boolean
  options: NativeApprovalOption[]
  busy?: boolean
  onReply: (choice: NativeApprovalChoice) => void
}

function ToolGlyph({ created, tool }: { created: boolean; tool: string }) {
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
  created: createdProp,
  onReply,
  options,
  overwrite: overwriteProp,
  path,
  preview,
  tool,
}: ToolApprovalCardProps) {
  const created = createdProp ?? previewLooksCreated(preview)
  const overwrite = overwriteProp ?? (tool === 'write_file' && !created)
  const title = approvalTitle(tool, created)
  const [expanded, setExpanded] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [moreBelow, setMoreBelow] = useState(true)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const lineCount = compactDiffLines(preview ?? '').length
  const overflows = !expanded && lineCount > APPROVAL_COLLAPSE_AFTER

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
          {path ? (
            <p
              className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground"
              data-testid="approval-path"
              title={path}
            >
              {path}
            </p>
          ) : null}
          {created ? (
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
                Show all {lineCount} lines
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-1.5 px-3 py-2">
        {options.map((option) => (
          <Button
            key={option.id}
            autoFocus={option.id === 'allow_once'}
            disabled={busy}
            size="sm"
            type="button"
            variant={optionVariant(option.id)}
            className={option.id === 'deny' ? 'text-destructive hover:text-destructive' : ''}
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
