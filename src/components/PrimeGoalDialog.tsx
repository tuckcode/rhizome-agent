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
import { createTranslator, type AppLocale } from '../lib/i18n'
import { buildGoalCommandText, parseGoalBudgetInput } from '../lib/primeGoalCommand'
import type { PrimeAgentActivity } from './AgentActivityBand'

export interface PrimeGoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale?: AppLocale
  /** Current goal, read fresh when the dialog opens — never assumed. */
  currentGoal: PrimeAgentActivity['goal'] | null
  onSetGoal: (objective: string, tokenBudget: number | null) => Promise<{ objective?: string }>
  onClearGoal: () => Promise<void>
}

type Status =
  | { kind: 'idle' }
  | { kind: 'setting' }
  | { kind: 'clearing' }
  | { kind: 'error'; message: string }

/**
 * Set, replace or clear the session goal (#20).
 *
 * This is the one harness control with no protocol call: Prime's daemon
 * exposes no `goal_create`/`goal_clear` command, so the objective and budget
 * here are sent as ordinary `/goal` prompt text, the same way Prime's own
 * CLI sets a goal. The confirmation shown here always comes from the Rust
 * side re-reading Prime's state after sending — never from the send
 * succeeding, which only means Prime accepted the text.
 */
export function PrimeGoalDialog({
  open,
  onOpenChange,
  locale = 'en',
  currentGoal,
  onSetGoal,
  onClearGoal,
}: PrimeGoalDialogProps) {
  const t = createTranslator(locale)
  const [objective, setObjective] = useState('')
  const [budgetText, setBudgetText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const isActive = Boolean(currentGoal?.active)

  // Reset the form on every open, without an effect: adjusting state during
  // render (rather than after, in an effect) avoids an extra cascading
  // render and matches React's own guidance for "reset on prop change".
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setObjective('')
      setBudgetText('')
      setStatus({ kind: 'idle' })
    }
  }

  const budget = parseGoalBudgetInput(budgetText)
  const budgetInvalid = budget === 'invalid'
  const objectiveEmpty = objective.trim().length === 0
  const preview = buildGoalCommandText(
    objective.trim() || t('ai.goal.objectivePlaceholder'),
    typeof budget === 'number' ? budget : null,
  )
  const busy = status.kind === 'setting' || status.kind === 'clearing'

  const handleSet = async () => {
    if (objectiveEmpty || budgetInvalid || busy) return
    setStatus({ kind: 'setting' })
    try {
      await onSetGoal(objective.trim(), typeof budget === 'number' ? budget : null)
      onOpenChange(false)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const handleClear = async () => {
    if (busy) return
    setStatus({ kind: 'clearing' })
    try {
      await onClearGoal()
      onOpenChange(false)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent data-testid="prime-goal-dialog">
        <DialogHeader>
          <DialogTitle>
            {isActive ? t('ai.goal.dialogTitleReplace') : t('ai.goal.dialogTitleSet')}
          </DialogTitle>
          <DialogDescription>{t('ai.goal.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <p className="text-muted-foreground text-xs" data-testid="prime-goal-current">
          {isActive && currentGoal?.objective
            ? t('ai.goal.currentActive', { objective: currentGoal.objective })
            : t('ai.goal.currentNone')}
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="prime-goal-objective" className="text-sm font-medium">
              {t('ai.goal.objectiveLabel')}
            </label>
            <Input
              id="prime-goal-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={t('ai.goal.objectivePlaceholder')}
              disabled={busy}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="prime-goal-budget" className="text-sm font-medium">
              {t('ai.goal.budgetLabel')}
            </label>
            <Input
              id="prime-goal-budget"
              inputMode="numeric"
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value)}
              placeholder={t('ai.goal.budgetPlaceholder')}
              disabled={busy}
              aria-invalid={budgetInvalid || undefined}
            />
            {budgetInvalid && (
              <p className="text-destructive text-xs">{t('ai.goal.budgetInvalid')}</p>
            )}
          </div>
          {!objectiveEmpty && !budgetInvalid && (
            <p className="text-muted-foreground font-mono text-[11px]" data-testid="prime-goal-preview">
              {t('ai.goal.commandPreview', { command: preview })}
            </p>
          )}
          {status.kind === 'setting' && (
            <p className="text-muted-foreground text-xs" role="status">
              {t('ai.goal.settingStatus')}
            </p>
          )}
          {status.kind === 'clearing' && (
            <p className="text-muted-foreground text-xs" role="status">
              {t('ai.goal.clearingStatus')}
            </p>
          )}
          {status.kind === 'error' && (
            <p className="text-destructive text-xs" role="alert" data-testid="prime-goal-error">
              {status.message}
            </p>
          )}
        </div>

        <DialogFooter>
          {isActive && (
            <Button variant="outline" onClick={() => void handleClear()} disabled={busy}>
              {t('ai.goal.clearButton')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('ai.goal.cancelButton')}
          </Button>
          <Button
            onClick={() => void handleSet()}
            disabled={busy || objectiveEmpty || budgetInvalid}
          >
            {isActive ? t('ai.goal.replaceButton') : t('ai.goal.setButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
