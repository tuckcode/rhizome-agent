import type { Settings } from '../types'

export function areAiFeaturesEnabled(settings: Pick<Settings, 'ai_features_enabled'> | null | undefined): boolean {
  return settings?.ai_features_enabled !== false
}
