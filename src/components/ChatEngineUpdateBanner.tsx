import { useState } from 'react'
import { Button } from './ui/button'
import type { PrimeUpdateStatus } from '../hooks/usePrimeUpdate'

interface ChatEngineUpdateBannerProps {
  status: PrimeUpdateStatus | undefined
  onUpdate: () => void
}

function offeredVersion(status: PrimeUpdateStatus | undefined): string | null {
  if (!status) return null
  if (status.state === 'available' || status.state === 'applying' || status.state === 'failed') {
    return status.version
  }
  if (status.state === 'applied') return status.installedVersion
  return null
}

/**
 * The Chat engine offer sits in the composer, in words.
 * A status-bar dot is easy to miss, and the build label is not this control.
 */
export function ChatEngineUpdateBanner({ status, onUpdate }: ChatEngineUpdateBannerProps) {
  const version = offeredVersion(status)
  const [hiddenVersion, setHiddenVersion] = useState<string | null>(null)

  if (!status || !version) return null
  if (status.state === 'available' && hiddenVersion === version) return null

  const applying = status.state === 'applying'
  const applied = status.state === 'applied'
  const failed = status.state === 'failed'

  return (
    <div
      className="mb-2 flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted px-3 py-2"
      data-testid="chat-engine-update-banner"
      role="status"
    >
      <p className="min-w-0 flex-1 text-[12px] font-medium text-foreground">
        {applied
          ? `Chat engine is now ${version}.`
          : applying
            ? `Applying Chat engine ${version}…`
            : `Chat engine ${version} is available.`}
        {failed ? ` ${status.message}` : null}
      </p>
      {status.state === 'available' ? (
        <Button type="button" variant="ghost" size="xs" onClick={() => setHiddenVersion(version)}>
          Not now
        </Button>
      ) : null}
      <Button
        type="button"
        size="xs"
        onClick={onUpdate}
        disabled={applying || applied}
      >
        {applied ? 'Updated' : applying ? 'Applying…' : 'Update now'}
      </Button>
    </div>
  )
}
