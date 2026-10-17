import type { Settings } from '../types'

export const DEFAULT_BLOCK_SECRET_FILES = true

export const SECRET_FILES_LABEL = 'Hide secret files from the agent'

export const SECRET_FILES_HELPER_ON =
  "The agent's file tools skip private keys, .env files and files with similar names."

export const SECRET_FILES_HELPER_OFF =
  "Off: the agent's file tools can open private keys and .env files."

export const SECRET_FILE_PATTERN_LINES = [
  'Private-key names in any folder, including backups: id_rsa, id_dsa, id_ecdsa, id_ecdsa_sk, id_ed25519, id_ed25519_sk, id_mldsa44_ed25519. Public .pub files stay visible.',
  '*.pem, *.key, *.p12, *.pfx, including backups such as .bak, ~, .old, .orig, .backup, .1, and .swp.',
  '.env files, except the exact name .env.example.',
  'Anything under a .git folder.',
] as const

export function shouldBlockSecretFiles(settings: Pick<Settings, 'block_secret_files'>): boolean {
  return settings.block_secret_files ?? DEFAULT_BLOCK_SECRET_FILES
}
