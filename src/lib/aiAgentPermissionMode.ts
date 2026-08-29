import type { AiAgentId } from './aiAgents'
import { createTranslator, type AppLocale } from './i18n'

export type AiAgentPermissionMode = 'safe' | 'power_user'

/** Fallback when a stored value is missing or garbage. CLI adapters stay least-privilege. */
export const DEFAULT_AI_AGENT_PERMISSION_MODE: AiAgentPermissionMode = 'safe'

/**
 * Prime has no sandbox (AGENTS.md). Safe is only a prompt instruction there,
 * and as a default it made the model refuse ordinary repo work.
 */
export const DEFAULT_PRIME_PERMISSION_MODE: AiAgentPermissionMode = 'power_user'

export const AI_AGENT_PERMISSION_MODE_LABELS: Record<
  AiAgentPermissionMode,
  { short: string; control: string }
> = {
  safe: {
    short: 'Limited',
    control: 'Limited tools',
  },
  power_user: {
    short: 'Power User',
    control: 'Power User',
  },
}

export function defaultAiAgentPermissionMode(agent?: AiAgentId | string): AiAgentPermissionMode {
  return agent === 'prime' ? DEFAULT_PRIME_PERMISSION_MODE : DEFAULT_AI_AGENT_PERMISSION_MODE
}

export function normalizeAiAgentPermissionMode(value: unknown): AiAgentPermissionMode {
  return value === 'power_user' ? 'power_user' : DEFAULT_AI_AGENT_PERMISSION_MODE
}

/**
 * Prime has no sandbox. Stored Safe is only a prompt instruction and was the
 * previous default, so Prime sessions always run as power user. Claude Code
 * and Antigravity keep the stored vault mode — they actually enforce it.
 */
export function resolvePermissionModeForAgent(
  agent: string | undefined,
  value: unknown,
): AiAgentPermissionMode {
  if (agent === 'prime') return DEFAULT_PRIME_PERMISSION_MODE
  return normalizeAiAgentPermissionMode(value)
}

export function permissionModeIsInstructionOnly(agent?: AiAgentId | string): boolean {
  return agent === 'prime'
}

export function aiAgentPermissionModeLabels(
  mode: AiAgentPermissionMode,
  locale: AppLocale = 'en',
  agent?: AiAgentId | string,
): { short: string; control: string } {
  const t = createTranslator(locale)
  const instruction = permissionModeIsInstructionOnly(agent)
  if (mode === 'power_user') {
    return {
      short: t(instruction ? 'ai.permission.prime.powerUser.short' : 'ai.permission.powerUser.short'),
      control: t(instruction ? 'ai.permission.prime.powerUser.control' : 'ai.permission.powerUser.control'),
    }
  }
  return {
    short: t(instruction ? 'ai.permission.prime.safe.short' : 'ai.permission.safe.short'),
    control: t(instruction ? 'ai.permission.prime.safe.control' : 'ai.permission.safe.control'),
  }
}

export function aiAgentPermissionModeTooltipKey(
  mode: AiAgentPermissionMode,
  agent?: AiAgentId | string,
): 'ai.permission.prime.safe.tooltip'
  | 'ai.permission.prime.powerUser.tooltip'
  | 'ai.permission.safe.tooltip'
  | 'ai.permission.powerUser.tooltip' {
  const instruction = permissionModeIsInstructionOnly(agent)
  if (mode === 'power_user') {
    return instruction ? 'ai.permission.prime.powerUser.tooltip' : 'ai.permission.powerUser.tooltip'
  }
  return instruction ? 'ai.permission.prime.safe.tooltip' : 'ai.permission.safe.tooltip'
}

export function aiAgentPermissionModeMarker(
  mode: AiAgentPermissionMode,
  locale: AppLocale = 'en',
  agent?: AiAgentId | string,
): string {
  const t = createTranslator(locale)
  const label = aiAgentPermissionModeLabels(mode, locale, agent).short
  return t('ai.permission.changed', { label })
}
