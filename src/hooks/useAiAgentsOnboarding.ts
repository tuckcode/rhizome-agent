import { useCallback, useState } from 'react'

const AI_AGENTS_ONBOARDING_DISMISSED_STORAGE_NAME = 'rhizome:ai-agents-onboarding-dismissed'
// Genuinely historical — a user who dismissed the old Claude-only
// onboarding flow should not see the merged AI-agents onboarding either.
// Do not rename this to "rhizome:...": that flow wrote "tolaria:...", so
// this must keep reading that literal string to still find a real prior
// dismissal, not the current generation's name.
const LEGACY_CLAUDE_ONBOARDING_DISMISSED_STORAGE_NAME = 'tolaria:claude-code-onboarding-dismissed'

function wasDismissed(): boolean {
  try {
    return (
      localStorage.getItem(AI_AGENTS_ONBOARDING_DISMISSED_STORAGE_NAME) === '1'
      || localStorage.getItem(LEGACY_CLAUDE_ONBOARDING_DISMISSED_STORAGE_NAME) === '1'
    )
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(AI_AGENTS_ONBOARDING_DISMISSED_STORAGE_NAME, '1')
    localStorage.setItem(LEGACY_CLAUDE_ONBOARDING_DISMISSED_STORAGE_NAME, '1')
  } catch {
    // localStorage may be unavailable in restricted contexts
  }
}

function clearDismissed(): void {
  try {
    localStorage.removeItem(AI_AGENTS_ONBOARDING_DISMISSED_STORAGE_NAME)
    localStorage.removeItem(LEGACY_CLAUDE_ONBOARDING_DISMISSED_STORAGE_NAME)
  } catch {
    // localStorage may be unavailable in restricted contexts
  }
}

export function useAiAgentsOnboarding(enabled: boolean) {
  const [dismissed, setDismissed] = useState(() => wasDismissed())

  const dismissPrompt = useCallback(() => {
    markDismissed()
    setDismissed(true)
  }, [])

  // Re-show the one-time onboarding on demand (e.g. from Settings → AI), so a
  // user who dismissed it can get back to the install/auth guidance later.
  const reopenPrompt = useCallback(() => {
    clearDismissed()
    setDismissed(false)
  }, [])

  return {
    dismissPrompt,
    reopenPrompt,
    showPrompt: enabled && !dismissed,
  }
}
