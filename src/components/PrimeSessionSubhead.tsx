import { createTranslator, type AppLocale } from '../lib/i18n'
import { shortPrimeSessionId, tildeVaultPath } from '../lib/primeSubheadLabels'

interface PrimeSessionSubheadProps {
  locale?: AppLocale
  /** Host is up and holding a session. */
  live: boolean
  sessionId?: string | null
  model?: string | null
  vaultPath?: string | null
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
}: PrimeSessionSubheadProps) {
  const t = createTranslator(locale)
  const shortId = shortPrimeSessionId(sessionId)
  const vault = tildeVaultPath(vaultPath)

  return (
    <div
      className="flex min-h-[30px] shrink-0 items-center gap-2.5 border-b border-border px-3 font-mono text-[10.5px] tracking-[0.03em] text-muted-foreground"
      data-testid="prime-session-subhead"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className={live ? 'size-[5px] rounded-full bg-primary' : 'size-[5px] rounded-full bg-muted-foreground/50'}
        />
        <span className={live ? 'text-primary' : undefined}>
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
    </div>
  )
}
