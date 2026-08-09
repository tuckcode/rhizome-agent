import { useRef, useState } from 'react'
import { CircleNotch as Loader2 } from '@phosphor-icons/react'
import { translate, type AppLocale } from '../../lib/i18n'
import { trackStatusBarPillOpened } from '../../lib/productAnalytics'
import type { RhizomeJob } from '../../hooks/useRhizomeJobs'
import { ICON_STYLE } from './styles'
import { useDismissibleLayer } from './useDismissibleLayer'
import { AgentActivityList } from './AgentActivityList'

interface AgentsPillProps {
  jobs: RhizomeJob[]
  onCancelJob: (jobId: string) => void
  locale?: AppLocale
}

function pillLabel(jobs: RhizomeJob[], locale: AppLocale): string {
  if (jobs.length === 0) return translate(locale, 'status.agents.idle')
  if (jobs.length === 1) return translate(locale, 'status.agents.working', { label: jobs[0].label })
  return translate(locale, 'status.agents.workingCount', { count: jobs.length })
}

/**
 * Wave 5.4b agents pill — `docs/design/shell-final-direction.md` §2.6 cluster 2.
 * Reads the same `useRhizomeJobs` store the rail's agent-avatar dot lights off,
 * so the two are guaranteed to agree. The dropdown lists in-flight jobs today;
 * the shared agent-activity feed (§2.4) replaces the body in wave 5.4c.
 */
export function AgentsPill({ jobs, onCancelJob, locale = 'en' }: AgentsPillProps) {
  const [open, setOpen] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  const working = jobs.length > 0

  useDismissibleLayer(open, pillRef, () => setOpen(false))

  const label = pillLabel(jobs, locale)

  return (
    <div ref={pillRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid="status-agents-pill"
        data-agents-state={working ? 'working' : 'idle'}
        aria-label={translate(locale, 'status.agents.open')}
        aria-expanded={open}
        onClick={() => {
          if (!open) trackStatusBarPillOpened('agents')
          setOpen((value) => !value)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 18,
          padding: '0 9px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 500,
          cursor: 'pointer',
          background: 'transparent',
          border: `1px solid ${working ? 'var(--accent-orange)' : 'var(--border)'}`,
          color: working ? 'var(--accent-orange)' : 'var(--muted-foreground)',
        }}
      >
        <span style={ICON_STYLE}>
          {working ? <Loader2 size={10} className="animate-spin" /> : null}
          {label}
        </span>
      </button>
      {open && (
        <div
          data-testid="status-agents-popup"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            background: 'var(--sidebar)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 8,
            minWidth: 220,
            boxShadow: '0 4px 12px var(--shadow-dialog)',
            zIndex: 1000,
            fontSize: 12,
            color: 'var(--foreground)',
          }}
        >
          <AgentActivityList jobs={jobs} locale={locale} onCancelJob={onCancelJob} />
        </div>
      )}
    </div>
  )
}
