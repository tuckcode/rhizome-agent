import { Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { subheadTrafficLightInset } from '../utils/trafficLights'
import {
  primeSessionUptime,
  shortPrimeSessionId,
  tildeVaultPath,
} from '../lib/primeSubheadLabels'

interface PrimeSessionSubheadProps {
  locale?: AppLocale
  /** Host is up and holding a session. */
  live: boolean
  sessionId?: string | null
  model?: string | null
  vaultPath?: string | null
  /**
   * When the attached session started, ISO-8601.
   *
   * A session outlives the window now (ADR-0163), so how long it has been
   * running is no longer implied by how long the app has been open.
   */
  startedAt?: string | null
  /** Frame A hides AiPanelHeader — New chat lives here instead. */
  onNewChat?: () => void
}

function Separator() {
  return <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
}

/**
 * Frame A's telemetry strip: what session you are in, on what model, against
 * what vault.
 *
 * Mono and muted on purpose — this is instrumentation, not content. It answers
 * "what am I actually talking to" at a glance, which in a chat-first window is
 * the question the missing chrome used to answer.
 */
export function PrimeSessionSubhead({
  locale = 'en',
  live,
  sessionId,
  model,
  vaultPath,
  startedAt,
  onNewChat,
}: PrimeSessionSubheadProps) {
  const t = createTranslator(locale)
  const trafficLightInset = subheadTrafficLightInset() as CSSProperties
  const shortId = shortPrimeSessionId(sessionId)
  const vault = tildeVaultPath(vaultPath)
  // Recomputed on render rather than on a timer of its own. Host status polls
  // every few seconds and re-renders this strip, which is frequent enough for
  // a minute-resolution label — and if polling stops, a frozen uptime is the
  // honest reading, since nothing is confirming the session is alive.
  const uptime = live ? primeSessionUptime(startedAt) : null

  return (
    <div
      className={cn(
        'flex min-h-[30px] shrink-0 items-center gap-2.5 border-b border-border pr-3',
        'font-mono text-[10.5px] tracking-[0.03em] text-muted-foreground',
        // macOS puts the traffic lights at x=58 (tauri.conf.json) and this strip
        // is the topmost band on ChatHome, so nothing else absorbs them. The
        // design system's own `.subhead` carries the same clearance as
        // `padding-left: 60px`; it is measured from the window edge, so the
        // 46px rail to our left comes off it.
        'pl-[var(--subhead-traffic-light-inset,0.75rem)]',
      )}
      style={trafficLightInset}
      data-testid="prime-session-subhead"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-[5px] rounded-full',
            // Status, not brand: --primary follows the user's accent choice, so
            // a red accent would make a healthy session read as an error.
            live ? 'bg-[var(--accent-green)]' : 'bg-muted-foreground/50',
          )}
        />
        <span className={live ? 'text-[var(--accent-green)]' : undefined}>
          {live ? t('ai.subhead.live') : t('ai.subhead.idle')}
        </span>
      </span>

      {shortId ? (
        <>
          <Separator />
          <span className="shrink-0">
            sess_<strong className="font-medium text-foreground">{shortId}</strong>
          </span>
        </>
      ) : null}

      {model ? (
        <>
          <Separator />
          <span className="min-w-0 truncate">
            {t('ai.subhead.model')} <strong className="font-medium text-foreground">{model}</strong>
          </span>
        </>
      ) : null}

      {vault ? (
        <>
          <Separator />
          <span className="min-w-0 truncate">
            {t('ai.subhead.vault')} <strong className="font-medium text-foreground">{vault}</strong>
          </span>
        </>
      ) : null}

      {uptime ? (
        <>
          <Separator />
          <span className="shrink-0">
            {t('ai.subhead.uptime')}{' '}
            <strong className="font-medium text-foreground">{uptime}</strong>
          </span>
        </>
      ) : null}

      {onNewChat ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto h-6 w-6 shrink-0 p-0 [&_svg:not([class*=size-])]:size-3.5"
          onClick={onNewChat}
          aria-label={t('ai.sessions.newChat')}
          title={t('ai.sessions.newChat')}
        >
          <Plus size={14} />
        </Button>
      ) : null}
    </div>
  )
}
