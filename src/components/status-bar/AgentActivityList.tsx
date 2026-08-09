import { CircleNotch as Loader2 } from '@phosphor-icons/react'
import { translate, type AppLocale } from '../../lib/i18n'
import type { RhizomeJob } from '../../hooks/useRhizomeJobs'

/**
 * The agent-activity body: a header, one row per in-flight job with a Cancel
 * control, and an explicit idle state.
 *
 * Shared deliberately — `docs/design/shell-final-direction.md` §5 requires the
 * agents status pill and the command rail's agent avatar to be two views of
 * one store, so they must not drift into rendering different things. Callers
 * own the popup chrome and positioning; this is only the contents.
 */
export function AgentActivityList({
  jobs,
  locale = 'en',
  onCancelJob,
}: {
  jobs: RhizomeJob[]
  locale?: AppLocale
  onCancelJob: (jobId: string) => void
}) {
  return (
    <>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--muted-foreground)' }}>
        {translate(locale, 'status.rhizomeJobs.activeHeader')}
      </div>
      {jobs.length === 0 ? (
        <div style={{ color: 'var(--muted-foreground)' }}>
          {translate(locale, 'status.agents.none')}
        </div>
      ) : (
        jobs.map((job) => (
          <div
            key={job.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Loader2 size={11} className="animate-spin" />
            <span style={{ flex: 1 }}>{job.label}</span>
            <button
              type="button"
              data-testid={`status-agents-cancel-${job.id}`}
              onClick={() => onCancelJob(job.id)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 11,
                cursor: 'pointer',
                color: 'var(--muted-foreground)',
              }}
            >
              {translate(locale, 'status.rhizomeJobs.cancel')}
            </button>
          </div>
        ))
      )}
    </>
  )
}
