import { Button } from '@/components/ui/button'
import type { SessionTranscriptHit } from '../lib/sessionTranscriptSearch'

interface SessionTranscriptSearchResultsProps {
  hits: SessionTranscriptHit[]
  onSelect?: (hit: SessionTranscriptHit) => void
}

function roleLabel(role: SessionTranscriptHit['role']): string {
  return role === 'user' ? 'You' : 'Assistant'
}

function HitBody({ hit }: { hit: SessionTranscriptHit }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
      <span className="flex w-full items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
          {hit.sessionTitle}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground/70">{roleLabel(hit.role)}</span>
      </span>
      <span className="line-clamp-2 text-left text-[11px] font-normal text-muted-foreground">
        {hit.excerpt}
      </span>
    </span>
  )
}

/**
 * Sessions group for the app search panel.
 *
 * A hit names the session and the transcript message index. Pass `onSelect`
 * to open that session at the hit.
 */
export function SessionTranscriptSearchResults({ hits, onSelect }: SessionTranscriptSearchResultsProps) {
  if (hits.length === 0) return null

  return (
    <section aria-label="Sessions" data-testid="session-transcript-results">
      <h2 className="border-t border-border/50 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
        Sessions
      </h2>
      <ul>
        {hits.map((hit) => (
          <li
            key={`${hit.sessionPath}:${hit.messageIndex}:${hit.role}`}
            data-message-index={hit.messageIndex}
            data-session-path={hit.sessionPath}
          >
            {onSelect ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-2.5 text-left font-normal hover:bg-secondary"
                onClick={() => onSelect(hit)}
              >
                <HitBody hit={hit} />
              </Button>
            ) : (
              <div className="px-4 py-2.5">
                <HitBody hit={hit} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
