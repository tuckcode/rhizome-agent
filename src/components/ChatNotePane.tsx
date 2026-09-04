import { X } from '@phosphor-icons/react'
import { startResizeDrag } from '../utils/startResizeDrag'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { MarkdownContent } from './MarkdownContent'

interface ChatNotePaneProps {
  locale?: AppLocale
  label: string
  /** Body, loaded by `useChatNoteContent` in Chat so the agent sees it too. */
  body?: string | null
  error?: boolean
  loading?: boolean
  /** Current width in px, owned by Chat so it can persist. */
  width?: number
  /** Raw horizontal delta from a drag on this pane's left edge. */
  onResize?: (deltaX: number) => void
  onClose: () => void
  onOpenNote?: (target: string) => void
}

/**
 * Frame B — secondary note split. Chat stays on screen.
 * Read-only body; Save belongs with promote, not this slice.
 */
export function ChatNotePane({
  locale = 'en',
  label,
  body = null,
  error = false,
  loading = false,
  width,
  onResize,
  onClose,
  onOpenNote,
}: ChatNotePaneProps) {
  const t = createTranslator(locale)
  return (
    <aside
      data-testid="chat-note-pane"
      className="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-background"
      style={width ? { width } : undefined}
    >
      {/* Sits on the border itself and reaches past it on both sides — a
          1px target is findable only by accident. */}
      {onResize ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('ai.chatNote.resize')}
          data-testid="chat-note-pane-resize"
          className="absolute inset-y-0 -left-[10px] z-20 w-4 cursor-col-resize bg-transparent transition-colors hover:bg-border"
          onMouseDown={(event) => startResizeDrag(event, 'col-resize', (deltaX) => onResize(deltaX))}
        />
      ) : null}
      <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-border px-2.5 font-mono text-[11px] tracking-[0.03em] text-muted-foreground">
        <span className="rounded-sm border border-border px-1.5 py-px text-[10px] uppercase tracking-[0.08em]">
          {t('ai.chatNote.tag')}
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-6 w-6 shrink-0 p-0 [&_svg:not([class*=size-])]:size-3.5"
          onClick={onClose}
          aria-label="Hide note"
          title="Hide note"
        >
          <X size={14} />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 py-3 text-sm">
          {error ? (
            <p className="text-xs text-destructive" role="alert">{t('ai.chatNote.error')}</p>
          ) : loading ? (
            <p className="text-xs text-muted-foreground">{t('ai.chatNote.loading')}</p>
          ) : body ? (
            <MarkdownContent content={body} onWikilinkClick={onOpenNote} />
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  )
}
