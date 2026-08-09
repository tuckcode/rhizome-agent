/**
 * Feature flag hook backed by PostHog + local overrides.
 *
 * Flags are resolved in order:
 *   1. localStorage override (`ff_<name>`) — for dev/QA testing
 *   2. PostHog feature flags
 *   3. FEATURE_DEFAULTS (`shell_command_rail` defaults ON — network shell)
 *
 * Classic status-bar chrome: set `ff_shell_command_rail=false`.
 * Alpha channel does not blanket-enable unrelated flags.
 */

import { isFeatureEnabled } from '../lib/telemetry'

/**
 * Known feature flags. The hook and its resolution order are wired and
 * tested; this union is the registry of live flag names.
 *
 * `shell_command_rail` — reserved for the Wave 5 icon/command-rail shell
 * redesign (see docs/plans "check the cracks" plan, Wave 5.3). It gates the
 * new IconRail layout so the redesign can land dark and be enabled per
 * channel/QA without disturbing the current shell. Add real flags here as
 * features adopt them; keep at least one so the type never widens to string.
 */
export type FeatureFlagName = 'shell_command_rail' | 'chat_primary_shell'

export function useFeatureFlag(flag: FeatureFlagName): boolean {
  try {
    const override = localStorage.getItem(`ff_${flag}`)
    if (override !== null) return override === 'true'
  } catch {
    // localStorage may be unavailable in some contexts
  }
  return isFeatureEnabled(flag)
}
