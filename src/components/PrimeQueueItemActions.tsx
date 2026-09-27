import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  mutatePrimeQueuedMessage,
  requestPrimeQueueRefresh,
  usePrimeQueueMutationAvailable,
  type PrimeQueueMutation,
} from '../hooks/usePrimeQueue'
import type { PrimeQueueItem } from '../lib/primeQueue'

/**
 * Rewrite or delete one queued line. The daemon verb stays in the hook.
 * Controls stay hidden until the host says this daemon can mutate the queue.
 */
export function PrimeQueueItemActions({ item }: { item: PrimeQueueItem }) {
  const available = usePrimeQueueMutationAvailable()
  const [draft, setDraft] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!available) return null

  const apply = async (mutation: PrimeQueueMutation) => {
    setBusy(true)
    setNotice(null)
    const status = await mutatePrimeQueuedMessage({
      lane: item.lane,
      index: item.index,
      expectedText: item.text,
      mutation,
    })
    setBusy(false)
    if (status === 'invalid') {
      setNotice('That edit is not a valid queued command.')
      return
    }
    if (status === 'applied' || status === 'rejected') {
      setDraft(null)
      requestPrimeQueueRefresh()
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {draft === null ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy}
            data-testid={`composer-queue-rewrite-${item.lane}-${item.index}`}
            onClick={() => {
              setDraft(item.text)
              setNotice(null)
            }}
          >
            Rewrite
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy}
            data-testid={`composer-queue-delete-${item.lane}-${item.index}`}
            onClick={() => void apply({ type: 'delete' })}
          >
            Delete
          </Button>
        </>
      ) : (
        <>
          <Input
            value={draft}
            aria-label="Rewrite queued line"
            data-testid={`composer-queue-rewrite-input-${item.lane}-${item.index}`}
            className="h-6 w-40 font-mono text-[12px]"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy}
            data-testid={`composer-queue-save-${item.lane}-${item.index}`}
            onClick={() => void apply({ type: 'replace', text: draft })}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() => {
              setDraft(null)
              setNotice(null)
            }}
          >
            Cancel
          </Button>
        </>
      )}
      {notice ? (
        <span className="text-[12px] text-muted-foreground">{notice}</span>
      ) : null}
    </div>
  )
}
