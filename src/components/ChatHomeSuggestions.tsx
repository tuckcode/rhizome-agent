import { ArrowSquareOut, Bug, Compass, FileText, TestTube, type Icon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { chatHomePrefillForNote, type ChatHomeNote } from '../lib/chatHomeNotes'
import { trackEvent } from '../lib/telemetry'
import { prefillAiComposer } from '../utils/aiPromptBridge'
import { relativeDate } from '../utils/noteListHelpers'

interface ChatHomeStarter {
  label: string
  detail: string
  prompt: string
  icon: Icon
}

const STARTERS: ChatHomeStarter[] = [
  { label: 'Explain this repo', detail: 'Map the code and its main flows', prompt: 'Explain this repo', icon: Compass },
  { label: 'Find and fix a bug', detail: 'Reproduce it, then repair it', prompt: 'Find and fix a bug', icon: Bug },
  { label: 'Write tests for a file', detail: 'Cover the cases that matter', prompt: 'Write tests for a file', icon: TestTube },
]

interface ChatHomeSuggestionsProps {
  recentNotes?: ChatHomeNote[]
  onOpenNote?: (path: string) => void
}

/**
 * The content under the composer on the new-chat screen: three starter
 * cards, then the notes that changed last. A starter or a note fills the
 * composer. It does not send.
 */
export function ChatHomeSuggestions({ recentNotes = [], onOpenNote }: ChatHomeSuggestionsProps) {
  return (
    <div className="mt-6 pb-[12vh]" data-testid="chat-home-suggestions">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STARTERS.map((starter) => (
          <Button
            key={starter.label}
            type="button"
            variant="outline"
            className="h-auto flex-col items-start gap-1.5 whitespace-normal rounded-xl px-3 py-3 text-left"
            aria-label={starter.label}
            data-testid="chat-empty-starter"
            onClick={() => prefillAiComposer(starter.prompt)}
          >
            <starter.icon aria-hidden="true" className="text-primary" size={18} />
            <span className="text-sm font-medium text-foreground">{starter.label}</span>
            <span className="text-xs font-normal text-muted-foreground">{starter.detail}</span>
          </Button>
        ))}
      </div>
      {recentNotes.length > 0 ? (
        <section
          aria-label="Continue from a note"
          className="mt-6"
          data-testid="chat-home-recent-notes"
        >
          <h3 className="px-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Continue from a note
          </h3>
          <ul className="mt-1.5 flex flex-col">
            {recentNotes.map((note) => (
              <li key={note.path} className="flex items-center gap-1 rounded-md hover:bg-[var(--state-hover)]">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-1.5 font-normal hover:bg-transparent"
                  aria-label={`Ask about ${note.title}`}
                  data-testid="chat-home-note"
                  onClick={() => {
                    trackEvent('chat_home_note_picked')
                    prefillAiComposer(chatHomePrefillForNote(note))
                  }}
                >
                  <FileText aria-hidden="true" className="shrink-0 text-muted-foreground" size={14} />
                  <span className="min-w-0 flex-1 truncate text-left text-sm text-foreground">{note.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeDate(note.modifiedAt)}</span>
                </Button>
                {onOpenNote ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="me-1 shrink-0 text-muted-foreground"
                    aria-label={`Open ${note.title}`}
                    title="Open note"
                    onClick={() => onOpenNote(note.path)}
                  >
                    <ArrowSquareOut aria-hidden="true" size={14} />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
