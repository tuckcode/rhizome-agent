import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'

export type ScheduledWorkKind = 'heartbeat' | 'cron'
export type HeartbeatDelivery = 'steer' | 'follow_up'

export interface PrimeScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale?: AppLocale
  onCreate: (
    kind: ScheduledWorkKind,
    schedule: string,
    prompt: string,
    deliveryMode: HeartbeatDelivery,
  ) => Promise<void>
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string }

/**
 * Create a heartbeat or a cron schedule (#14).
 *
 * See/pause/cancel already live on the activity band. Create cannot live
 * there: an idle session must not advertise scheduled work that is not in
 * use. This dialog is the same kind of opt-in as Goal — a control you open,
 * not a strip that appears on its own.
 */
export function PrimeScheduleDialog({
  open,
  onOpenChange,
  locale = 'en',
  onCreate,
}: PrimeScheduleDialogProps) {
  const t = createTranslator(locale)
  const [kind, setKind] = useState<ScheduledWorkKind>('heartbeat')
  const [schedule, setSchedule] = useState('')
  const [prompt, setPrompt] = useState('')
  const [delivery, setDelivery] = useState<HeartbeatDelivery>('steer')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setKind('heartbeat')
      setSchedule('')
      setPrompt('')
      setDelivery('steer')
      setStatus({ kind: 'idle' })
    }
  }

  const missing = schedule.trim().length === 0 || prompt.trim().length === 0
  const busy = status.kind === 'saving'

  const handleSubmit = async () => {
    if (missing || busy) return
    setStatus({ kind: 'saving' })
    try {
      await onCreate(kind, schedule.trim(), prompt.trim(), delivery)
      onOpenChange(false)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent data-testid="prime-schedule-dialog">
        <DialogHeader>
          <DialogTitle>{t('ai.schedule.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('ai.schedule.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex gap-1">
            <Button
              type="button"
              size="xs"
              variant={kind === 'heartbeat' ? 'secondary' : 'ghost'}
              data-testid="prime-schedule-kind-heartbeat"
              aria-pressed={kind === 'heartbeat'}
              onClick={() => setKind('heartbeat')}
              disabled={busy}
            >
              {t('ai.schedule.kindHeartbeat')}
            </Button>
            <Button
              type="button"
              size="xs"
              variant={kind === 'cron' ? 'secondary' : 'ghost'}
              data-testid="prime-schedule-kind-cron"
              aria-pressed={kind === 'cron'}
              onClick={() => setKind('cron')}
              disabled={busy}
            >
              {t('ai.schedule.kindCron')}
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="prime-schedule-cadence" className="text-sm font-medium">
              {t('ai.schedule.cadenceLabel')}
            </label>
            <Input
              id="prime-schedule-cadence"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder={
                kind === 'heartbeat'
                  ? t('ai.schedule.cadencePlaceholderHeartbeat')
                  : t('ai.schedule.cadencePlaceholderCron')
              }
              disabled={busy}
            />
            <p className="text-muted-foreground text-xs">
              {kind === 'heartbeat'
                ? t('ai.schedule.cadenceHintHeartbeat')
                : t('ai.schedule.cadenceHintCron')}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="prime-schedule-prompt" className="text-sm font-medium">
              {t('ai.schedule.promptLabel')}
            </label>
            <Textarea
              id="prime-schedule-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('ai.schedule.promptPlaceholder')}
              disabled={busy}
              rows={3}
            />
          </div>

          {kind === 'heartbeat' ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t('ai.schedule.deliveryLabel')}</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant={delivery === 'steer' ? 'secondary' : 'ghost'}
                  data-testid="prime-schedule-delivery-steer"
                  aria-pressed={delivery === 'steer'}
                  onClick={() => setDelivery('steer')}
                  disabled={busy}
                >
                  {t('ai.schedule.deliverySteer')}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={delivery === 'follow_up' ? 'secondary' : 'ghost'}
                  data-testid="prime-schedule-delivery-follow-up"
                  aria-pressed={delivery === 'follow_up'}
                  onClick={() => setDelivery('follow_up')}
                  disabled={busy}
                >
                  {t('ai.schedule.deliveryFollowUp')}
                </Button>
              </div>
            </div>
          ) : null}

          {status.kind === 'error' ? (
            <p className="text-destructive text-xs" role="alert">
              {status.message}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t('ai.schedule.cancelButton')}
          </Button>
          <Button
            type="button"
            data-testid="prime-schedule-submit"
            onClick={() => void handleSubmit()}
            disabled={missing || busy}
            className={cn(busy && 'opacity-70')}
          >
            {t('ai.schedule.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
