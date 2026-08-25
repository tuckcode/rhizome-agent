import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, X } from '@phosphor-icons/react'
import { callHost } from '../lib/callHost'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackPrimeRlmChildStopped } from '../lib/productAnalytics'
import {
  familyForRoot,
  rosterActivityMessageKey,
  type PrimeRosterSession,
  type RlmFamilyMember,
} from '../lib/primeRunningSessions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 4000

function activityLabel(
  member: RlmFamilyMember,
  t: ReturnType<typeof createTranslator>,
): string {
  if (member.activity.kind === 'summary') return member.activity.text
  return t(rosterActivityMessageKey(member.activity.key))
}

/**
 * The live chat session's RLM children, from the roster we already fetch.
 *
 * Prime owns the children. Rhizome only shows them and can ask Prime to stop
 * one. Renders nothing when the attached session has no family — same silence
 * rule as the activity band.
 */
export function RlmFamilyBand({
  locale = 'en',
  enabled = true,
  liveSessionId,
  now,
}: {
  locale?: AppLocale
  enabled?: boolean
  liveSessionId?: string | null
  /** Test seam: skips the roster poll. */
  now?: RlmFamilyMember[]
}) {
  const t = createTranslator(locale)
  const [members, setMembers] = useState<RlmFamilyMember[]>(now ?? [])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const refresh = useCallback(() => {
    if (now || !enabled || !liveSessionId || inFlight.current) return
    inFlight.current = true
    void (async () => {
      try {
        const roster = await callHost<PrimeRosterSession[]>('list_prime_running_sessions')
        setMembers(familyForRoot(roster, liveSessionId))
      } catch {
        // Keep the last family: an unreachable daemon is ordinary, and
        // blanking the list reads as "the children vanished".
      } finally {
        inFlight.current = false
      }
    })()
  }, [enabled, liveSessionId, now])

  useEffect(() => {
    if (now) {
      setMembers(now)
      return
    }
    if (!enabled || !liveSessionId) {
      setMembers([])
      return
    }
    refresh()
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, liveSessionId, now, refresh])

  const stop = useCallback(
    async (childId: string) => {
      setBusyId(childId)
      setError(null)
      try {
        await callHost('cancel_prime_rlm_child', { childId })
        trackPrimeRlmChildStopped()
        refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusyId(null)
      }
    },
    [refresh],
  )

  if (!enabled || members.length === 0) return null

  return (
    <div
      className="flex min-h-[24px] shrink-0 flex-col gap-1 border-b border-border px-3 py-1 font-mono text-[10px] tracking-[0.02em]"
      data-testid="rlm-family-band"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Brain size={11} weight="regular" aria-hidden="true" />
        <span>{t('ai.activity.rlmFamily', { count: members.length })}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex min-w-0 items-center gap-2"
            data-testid="rlm-family-member"
            style={{ paddingLeft: `${(member.depth - 1) * 12}px` }}
          >
            <span className={cn('min-w-0 flex-1 truncate', member.working && 'text-foreground')}>
              {member.title}
              <span className="text-muted-foreground"> · {activityLabel(member, t)}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              data-testid="rlm-family-stop"
              disabled={busyId === member.id}
              onClick={() => void stop(member.id)}
            >
              <X size={10} aria-hidden="true" />
              {t('ai.activity.rlmStop')}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-destructive" data-testid="rlm-family-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
