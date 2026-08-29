import { useCallback, useState } from 'react'
import { callHost } from '../lib/callHost'
import { trackEvent } from '../lib/telemetry'
import type { PrimeAgentActivity } from './AgentActivityBand'

interface UseAiPanelGoalDialogResult {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentGoal: PrimeAgentActivity['goal'] | null
  onSetGoal: (objective: string, tokenBudget: number | null) => Promise<{ objective?: string }>
  onClearGoal: () => Promise<void>
  /** Wired to the composer-foot trigger button. */
  openDialog: () => void
}

/**
 * Goal dialog state (#20): opened on demand, not polled — the goal strip
 * (`AgentActivityBand`, wired in `ChatHome`) already polls for display. This
 * only needs a fresh read at the moment the dialog opens, so the "current
 * goal" shown here can never be stale.
 */
export function useAiPanelGoalDialog(): UseAiPanelGoalDialogResult {
  const [open, setOpen] = useState(false)
  const [currentGoal, setCurrentGoal] = useState<PrimeAgentActivity['goal'] | null>(null)

  const openDialog = useCallback(() => {
    setOpen(true)
    void callHost<PrimeAgentActivity>('get_prime_agent_activity')
      .then((activity) => setCurrentGoal(activity?.goal ?? null))
      .catch(() => setCurrentGoal(null))
  }, [])

  const onSetGoal = useCallback(async (objective: string, tokenBudget: number | null) => {
    const goal = await callHost<{ objective?: string }>('set_prime_goal', {
      objective,
      tokenBudget: tokenBudget ?? undefined,
    })
    // ProductAnalyticsProperties is Record<string, string | number> — a raw
    // boolean does not typecheck under the build's stricter pass.
    trackEvent('prime_goal_set', { has_budget: tokenBudget !== null ? 'yes' : 'no' })
    return goal
  }, [])

  const onClearGoal = useCallback(async () => {
    await callHost<void>('clear_prime_goal')
    trackEvent('prime_goal_cleared')
  }, [])

  return { open, onOpenChange: setOpen, currentGoal, onSetGoal, onClearGoal, openDialog }
}
