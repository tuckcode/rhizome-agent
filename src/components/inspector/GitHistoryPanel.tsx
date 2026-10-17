import { ArrowCounterClockwise } from '@phosphor-icons/react'
import type { GitCommit } from '../../types'
import { CommitSubjectTooltip } from '../CommitSubjectTooltip'
import { commitSubject } from '../../utils/commitSubject'

function formatRelativeDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const days = Math.floor((now - timestamp) / 86400)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1mo ago' : `${months}mo ago`
}

const INSPECTOR_ROW_FOCUS_CLASS_NAME = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:ring-inset'

function commitRowName(shortHash: string, subject: string): string {
  const visible = subject ? `${shortHash} · ${subject}` : shortHash
  return `${visible}. View diff`
}

export function GitHistoryPanel({ commits, onViewCommitDiff }: { commits: GitCommit[]; onViewCommitDiff?: (commitHash: string) => void }) {
  if (commits.length === 0) return null

  return (
    <div>
      <h4 className="font-mono-overline mb-2 flex items-center gap-1 text-muted-foreground">
        <ArrowCounterClockwise size={12} className="shrink-0" />
        History
      </h4>
      <div className="flex flex-col gap-2.5">
        {commits.map((c) => {
          const subject = commitSubject(c.message)
          return (
            <div key={c.hash} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
              <CommitSubjectTooltip subject={subject} side="bottom">
                <button type="button"
                  className={`mb-0.5 w-full cursor-pointer truncate border-none bg-transparent p-0 text-left text-xs text-primary hover:underline ${INSPECTOR_ROW_FOCUS_CLASS_NAME}`}
                  onClick={() => onViewCommitDiff?.(c.hash)}
                  aria-label={commitRowName(c.shortHash, subject)}
                >
                  <span className="font-mono" style={{ fontSize: 11 }}>{c.shortHash}</span>
                  {subject ? ` · ${subject}` : null}
                </button>
              </CommitSubjectTooltip>
              <div className="text-muted-foreground" style={{ fontSize: 10 }}>
                {formatRelativeDate(c.date)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
