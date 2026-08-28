import { X } from '@phosphor-icons/react'
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
  onClose,
  onOpenNote,
}: ChatNotePaneProps) {
  const t = createTranslator(locale)
  return (
    <aside
      data-testid="chat-note-pane"
      className="flex min-h-0 w-[min(40%,28rem)] shrink-0 flex-col border-l border-border bg-background"
    >
      <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-border px-2.5 font-mono text-[10.5px] tracking-[0.03em] text-muted-foreground">
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
          aria-label={t('ai.chatNote.close')}
          title={t('ai.chatNote.close')}
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
