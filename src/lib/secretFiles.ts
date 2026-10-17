import type { Settings } from '../types'

export const DEFAULT_BLOCK_SECRET_FILES = true

export function shouldBlockSecretFiles(settings: Pick<Settings, 'block_secret_files'>): boolean {
  return settings.block_secret_files ?? DEFAULT_BLOCK_SECRET_FILES
}
