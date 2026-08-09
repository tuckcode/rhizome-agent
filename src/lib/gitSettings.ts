import type { Settings } from '../types'

export function areGitFeaturesEnabled(settings: Pick<Settings, 'git_enabled'>): boolean {
  return settings.git_enabled !== false
}
