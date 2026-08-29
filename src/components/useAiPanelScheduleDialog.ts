import { useCallback, useState } from 'react'
import { callHost } from '../lib/callHost'
import { trackPrimeScheduledWorkCreated } from '../lib/productAnalytics'
import { usePrimeActivity } from './primeActivityContext'
import type { ScheduledWorkKind, HeartbeatDelivery } from './PrimeScheduleDialog'

interface UseAiPanelScheduleDialogResult {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (
    kind: ScheduledWorkKind,
    schedule: string,
    prompt: string,
    deliveryMode: HeartbeatDelivery,
  ) => Promise<void>
}

/** Scheduled-work dialog state: create a heartbeat/goal job, then refresh the activity strip so a new job shows up without a manual reload. */
export function useAiPanelScheduleDialog(): UseAiPanelScheduleDialogResult {
  const { refresh: refreshActivity } = usePrimeActivity()
  const [open, setOpen] = useState(false)

  const onCreate = useCallback(
    async (
      kind: ScheduledWorkKind,
      schedule: string,
      prompt: string,
      deliveryMode: HeartbeatDelivery,
    ) => {
      await callHost('create_prime_scheduled_work', {
        kind,
        schedule,
        prompt,
        deliveryMode: kind === 'heartbeat' ? deliveryMode : undefined,
      })
      trackPrimeScheduledWorkCreated(kind)
      await refreshActivity()
    },
    [refreshActivity],
  )

  return { open, onOpenChange: setOpen, onCreate }
}
