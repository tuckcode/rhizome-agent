import { FilePlus, NotePencil, PencilSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DiffView } from './DiffView'
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
  if (id === 'allow_session') return 'default'
  if (id === 'deny') return 'ghost'
  return 'outline'
}

export function ToolApprovalCard({
  busy = false,
  onReply,
  options,
  path,
  preview,
  tool,
}: ToolApprovalCardProps) {
  const created = previewLooksCreated(preview)
  const title = approvalTitle(tool, created)

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
              className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.02em] text-muted-foreground"
              data-testid="approval-status"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              ASK
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
        </div>
      </header>
      <div
        className="max-h-64 overflow-auto border-y border-border bg-muted/40"
        data-testid="approval-diff"
      >
        <DiffView compact diff={preview ?? ''} />
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-1.5 px-3 py-2">
        {options.map((option) => (
          <Button
            key={option.id}
            disabled={busy}
            size="sm"
            type="button"
            variant={optionVariant(option.id)}
            className={option.id === 'deny' ? 'text-destructive hover:text-destructive' : undefined}
            data-testid={`approval-${option.id}`}
            onClick={() => onReply(option.id as NativeApprovalChoice)}
          >
            {option.label}
          </Button>
        ))}
      </footer>
    </section>
  )
}
